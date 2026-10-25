package ru.alfa.navigator;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.*;
import ru.alfa.navigator.common.Api.*;
import ru.alfa.navigator.common.ApiException;
import ru.alfa.navigator.scoringclient.FinancialEngineClient;
import java.net.InetSocketAddress;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
class FinancialEngineClientTest {
 HttpServer server;ValidatorFactory factory;ObjectMapper mapper;FinancialEngineClient client;
 AtomicReference<String> request=new AtomicReference<>();AtomicReference<String> protocol=new AtomicReference<>();AtomicReference<String> contentType=new AtomicReference<>();String response;int status;
 @BeforeEach void setup() throws Exception {
  mapper=new ObjectMapper().findAndRegisterModules().disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT).enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);factory=Validation.buildDefaultValidatorFactory();status=200;
  server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/internal/v1/evaluate",exchange->{protocol.set(exchange.getProtocol());contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));request.set(new String(exchange.getRequestBody().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));exchange.getResponseHeaders().add("Content-Type","application/json");byte[] bytes=response.getBytes(java.nio.charset.StandardCharsets.UTF_8);exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();});server.start();
  client=new FinancialEngineClient("http://127.0.0.1:"+server.getAddress().getPort(),factory.getValidator(),mapper);
  var months=java.util.stream.IntStream.rangeClosed(1,12).mapToObj(i->new MonthPoint(i,100L,50L,20L,30L,1000L+i*30L)).toList();
  response=mapper.writeValueAsString(new SimulationResponse(20L,new BigDecimal("2.50"),1000,RiskLevel.LOW,Recommendation.APPROVE,List.of(new RiskFactor("STRONG_CASH_FLOW","fixture",0)),Arrays.stream(ScenarioName.values()).map(n->new Scenario(n,1030L,0,months)).toList(),List.of()));
 }
 @AfterEach void stop() {server.stop(0);factory.close();}
 EngineEvaluateRequest input() {return new EngineEvaluateRequest(null,new EngineProduct(1L,new BigDecimal("20.0"),100000L,10000000L,List.of(12,24,36)),new EngineCompany(48,1800000L,120000L,0,0L,true,java.util.stream.IntStream.range(0,12).mapToObj(i->new MonthlyFinancial(java.time.YearMonth.of(2025,10).plusMonths(i).toString(),2100000L,1450000L)).toList()),3000000L,36,150000L,4);}
 @Test void usesHttp11AndExactInternalPayload() throws Exception {assertEquals(1000,client.evaluate(input()).score());assertEquals("HTTP/1.1",protocol.get());assertEquals("application/json",contentType.get());var body=mapper.readTree(request.get());assertTrue(body.get("applicationId").isNull());assertEquals(12,body.at("/company/financials").size());assertFalse(body.get("company").has("name"));assertFalse(body.get("product").has("name"));assertEquals(3000000,body.get("requestedAmountRub").asInt());}
 @Test void rejectsEngineError() {status=422;response="{}";assertEquals(503,assertThrows(ApiException.class,()->client.evaluate(input())).status);}
 @Test void rejectsMissingFields() {response="{}";assertEquals("ENGINE_UNAVAILABLE",assertThrows(ApiException.class,()->client.evaluate(input())).code);}
 @Test void rejectsUnknownFields() {response=response.replaceFirst("\\{","{\"fabricated\":true,");assertThrows(ApiException.class,()->client.evaluate(input()));}
 @Test void rejectsFractionalRubleResponse() {response=response.replace("\"monthlyPaymentRub\":20","\"monthlyPaymentRub\":20.5");assertThrows(ApiException.class,()->client.evaluate(input()));}
}
