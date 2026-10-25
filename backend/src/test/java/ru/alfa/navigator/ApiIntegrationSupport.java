package ru.alfa.navigator;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.*;
import ru.alfa.navigator.common.Api.*;
import ru.alfa.navigator.common.ApiException;
import ru.alfa.navigator.scoringclient.FinancialEngineClient;
import java.math.BigDecimal;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
@SpringBootTest @AutoConfigureMockMvc
abstract class ApiIntegrationSupport {
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate db;
 @MockitoBean FinancialEngineClient engine;
 String owner,bank,other;
 static final String INPUT="{\"productId\":1,\"requestedAmountRub\":3000000,\"termMonths\":36,\"purpose\":\"EQUIPMENT\",\"projectedRevenueUpliftMonthlyRub\":150000,\"upliftStartMonth\":4}";
 @BeforeEach void setup() throws Exception {owner=login("owner@demo.local");bank=login("bank@demo.local");other=login("owner2@demo.local");when(engine.evaluate(any())).thenReturn(result());}
 SimulationResponse result() {
  var months=java.util.stream.IntStream.rangeClosed(1,12).mapToObj(i->new MonthPoint(i,2100000L,1450000L,231491L,418509L,1800000L+i*418509L)).toList();
  return new SimulationResponse(111491L,new BigDecimal("2.81"),1000,RiskLevel.LOW,Recommendation.APPROVE,List.of(new RiskFactor("STRONG_CASH_FLOW","Synthetic test fixture",0)),Arrays.stream(ScenarioName.values()).map(n->new Scenario(n,2218509L,0,months)).toList(),List.of());
 }
 String login(String email) throws Exception {return request(post("/api/v1/auth/login"),null,"{\"email\":\""+email+"\",\"password\":\"Demo123!\"}",200).get("accessToken").asText();}
 JsonNode request(MockHttpServletRequestBuilder b,String token,String body,int status) throws Exception {
  if(token!=null)b.header("Authorization","Bearer "+token);if(body!=null)b.contentType("application/json").content(body);
  var r=mvc.perform(b).andReturn().getResponse();assertEquals(status,r.getStatus(),r.getContentAsString());return r.getContentAsString().isBlank()?json.nullNode():json.readTree(r.getContentAsString());
 }
 long draft() throws Exception {return request(post("/api/v1/applications"),owner,INPUT,201).get("id").asLong();}
 JsonNode submit(long id) throws Exception {return request(post("/api/v1/applications/"+id+"/submit"),owner,null,200);}
 JsonNode decision(long id,String decision,String fields) throws Exception {return request(post("/api/v1/bank/applications/"+id+"/decision"),bank,"{\"decision\":\""+decision+"\",\"comment\":\"Synthetic decision\""+fields+"}",200);}
 @Test void authRoleAndIsolation() throws Exception {
  request(get("/api/v1/companies/me"),null,null,401);request(get("/api/v1/companies/me"),"broken",null,401);request(get("/api/v1/companies/me"),bank,null,403);request(get("/api/v1/bank/applications"),owner,null,403);
  long id=draft();request(get("/api/v1/applications/"+id),other,null,403);request(put("/api/v1/applications/"+id),other,INPUT,403);request(post("/api/v1/applications/"+id+"/submit"),other,null,403);
  assertTrue(request(get("/api/v1/applications"),other,null,200).findValues("id").stream().noneMatch(n->n.asLong()==id));
 }
 @Test void fullApprovalAndHistory() throws Exception {
  long id=draft();JsonNode reviewed=submit(id);assertEquals("UNDER_REVIEW",reviewed.get("status").asText());assertEquals(3,reviewed.get("history").size());assertEquals(1000,reviewed.at("/scoring/score").asInt());
  JsonNode offered=decision(id,"APPROVE",",\"offeredAmountRub\":2800000,\"offeredTermMonths\":36");assertEquals(20,offered.at("/offer/annualRatePct").asInt());
  request(post("/api/v1/applications/"+id+"/accept-offer"),owner,null,200);JsonNode issued=request(post("/api/v1/bank/applications/"+id+"/simulate-disbursement"),bank,null,200);assertEquals("SIMULATED_ISSUED",issued.get("status").asText());assertEquals(6,issued.get("history").size());
  assertEquals(1,db.queryForObject("select count(*) from scoring_results where application_id=?",Integer.class,id));
 }
 @Test void declineIsFinal() throws Exception {long id=draft();submit(id);assertEquals("DECLINED",decision(id,"DECLINE","").get("status").asText());request(post("/api/v1/applications/"+id+"/accept-offer"),owner,null,409);request(post("/api/v1/applications/"+id+"/submit"),owner,null,409);}
 @Test void requestInfoResubmitsAndPreservesSnapshots() throws Exception {
  long id=draft();var first=submit(id);String before=db.queryForObject("select company_and_financials_snapshot_json from application_snapshots where application_id=? order by id limit 1",String.class,id);
  decision(id,"REQUEST_INFO","");request(put("/api/v1/applications/"+id),owner,INPUT.replace("3000000","2500000"),200);
  JsonNode current=request(get("/api/v1/companies/me"),owner,null,200);var update=json.createObjectNode();update.set("financials",current.get("financials"));update.put("cashBalanceRub",current.get("cashBalanceRub").asLong()+100);update.set("existingDebtMonthlyRub",current.get("existingDebtMonthlyRub"));
  try {request(put("/api/v1/companies/me/financials"),owner,update.toString(),200);var next=request(post("/api/v1/applications/"+id+"/resubmit"),owner,null,200);assertEquals("UNDER_REVIEW",next.get("status").asText());assertEquals(first.at("/financialSnapshot/company/cashBalanceRub").asLong()+100,next.at("/financialSnapshot/company/cashBalanceRub").asLong());}
  finally {update.set("cashBalanceRub",current.get("cashBalanceRub"));request(put("/api/v1/companies/me/financials"),owner,update.toString(),200);}
  assertEquals(before,db.queryForObject("select company_and_financials_snapshot_json from application_snapshots where application_id=? order by id limit 1",String.class,id));assertEquals(2,db.queryForObject("select count(*) from application_snapshots where application_id=?",Integer.class,id));assertEquals(2,db.queryForObject("select count(*) from scoring_results where application_id=?",Integer.class,id));
 }
 @Test void failedEngineCommitsCheckingAndRetryReusesSnapshot() throws Exception {
  long id=draft();when(engine.evaluate(any())).thenThrow(ApiException.engine());var error=request(post("/api/v1/applications/"+id+"/submit"),owner,null,503);assertEquals("ENGINE_UNAVAILABLE",error.get("code").asText());var current=request(get("/api/v1/applications/"+id),owner,null,200);assertEquals("CHECKING",current.get("status").asText());assertTrue(current.get("scoring").isNull());
  assertEquals(1,db.queryForObject("select count(*) from application_snapshots where application_id=?",Integer.class,id));assertEquals(0,db.queryForObject("select count(*) from scoring_results where application_id=?",Integer.class,id));
  doReturn(result()).when(engine).evaluate(any());assertEquals("UNDER_REVIEW",submit(id).get("status").asText());assertEquals(1,db.queryForObject("select count(*) from application_snapshots where application_id=?",Integer.class,id));assertEquals(3,db.queryForObject("select count(*) from application_status_history where application_id=?",Integer.class,id));request(post("/api/v1/applications/"+id+"/submit"),owner,null,409);
 }
 @Test void rejectsInvalidAndUnknownFields() throws Exception {request(post("/api/v1/applications"),owner,INPUT.replace("3000000","1"),400);request(post("/api/v1/applications"),owner,INPUT.replace("\"upliftStartMonth\":4","\"upliftStartMonth\":13"),400);request(post("/api/v1/applications"),owner,INPUT.replace("3000000","3000000.5"),400);request(post("/api/v1/applications"),owner,INPUT.replace("{","{\"status\":\"OFFERED\","),400);request(post("/api/v1/applications"),bank,INPUT,403);}
 @Test void offerLimitsAndDoubleDecision() throws Exception {long id=draft();submit(id);request(post("/api/v1/bank/applications/"+id+"/decision"),bank,"{\"decision\":\"APPROVE\",\"comment\":\"test\",\"offeredAmountRub\":4000000,\"offeredTermMonths\":36}",400);decision(id,"APPROVE",",\"offeredAmountRub\":2800000,\"offeredTermMonths\":36");request(post("/api/v1/bank/applications/"+id+"/decision"),bank,"{\"decision\":\"DECLINE\",\"comment\":\"test\"}",409);}
 @Test void simulationDoesNotCreateApplications() throws Exception {int before=db.queryForObject("select count(*) from loan_applications",Integer.class);request(post("/api/v1/simulations"),owner,INPUT.replace(",\"purpose\":\"EQUIPMENT\"",""),200);assertEquals(before,db.queryForObject("select count(*) from loan_applications",Integer.class));verify(engine).evaluate(argThat(p->p.applicationId()==null && p.company().financials().size()==12));}
 @Test void incompleteFinancialHistoryNeedsInfoWithoutInvalidPublicSnapshot() throws Exception {
  long id=draft();var original=request(get("/api/v1/companies/me"),owner,null,200);
  db.update("delete from monthly_financials where company_id=1 and month='2025-10'");
  try {var reviewed=submit(id);assertEquals("NEEDS_INFO",reviewed.get("status").asText());assertTrue(reviewed.get("financialSnapshot").isNull());assertTrue(reviewed.get("scoring").isNull());assertEquals(1,db.queryForObject("select count(*) from application_snapshots where application_id=?",Integer.class,id));verify(engine,never()).evaluate(any());}
  finally {var update=json.createObjectNode();update.set("financials",original.get("financials"));update.set("cashBalanceRub",original.get("cashBalanceRub"));update.set("existingDebtMonthlyRub",original.get("existingDebtMonthlyRub"));request(put("/api/v1/companies/me/financials"),owner,update.toString(),200);}
 }
 @Test void longBankCommentIsPreserved() throws Exception {long id=draft();submit(id);var p=json.createObjectNode();p.put("decision","REQUEST_INFO");p.put("comment","Synthetic explanatory comment ".repeat(40));var v=request(post("/api/v1/bank/applications/"+id+"/decision"),bank,p.toString(),200);assertEquals(p.get("comment").asText(),v.get("statusComment").asText());}
}
