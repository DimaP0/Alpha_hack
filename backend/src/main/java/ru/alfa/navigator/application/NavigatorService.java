package ru.alfa.navigator.application;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.alfa.navigator.common.Api.*;
import ru.alfa.navigator.common.ApiException;
import ru.alfa.navigator.common.JsonCodec;
import ru.alfa.navigator.scoringclient.FinancialEngineClient;
import java.time.Instant;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Supplier;

@Service
public class NavigatorService {
 @PersistenceContext private EntityManager em;
 private final TransactionTemplate tx; private final JsonCodec json; private final FinancialEngineClient engine;
 public NavigatorService(PlatformTransactionManager tm,JsonCodec json,FinancialEngineClient engine) {tx=new TransactionTemplate(tm);this.json=json;this.engine=engine;}
 private <T> T inTx(Supplier<T> task) {return tx.execute(status->task.get());}
 private static void role(UserEntity u,Role required) {if(u.role!=required)throw ApiException.forbidden();}
 private <T> T get(Class<T> type,Long id) {T value=em.find(type,id);if(value==null)throw ApiException.missing();return value;}
 private LoanApplicationEntity app(Long id,boolean lock) {LoanApplicationEntity a=lock?em.find(LoanApplicationEntity.class,id,LockModeType.PESSIMISTIC_WRITE):em.find(LoanApplicationEntity.class,id);if(a==null)throw ApiException.missing();return a;}
 private void owner(UserEntity u,LoanApplicationEntity a) {role(u,Role.ENTREPRENEUR);if(!Objects.equals(u.companyId,a.companyId)||!Objects.equals(u.id,a.createdByUserId))throw ApiException.forbidden();}
 private void readable(UserEntity u,LoanApplicationEntity a) {if(u.role!=Role.BANK_OFFICER)owner(u,a);}
 private CompanyEntity lockedCompany(Long id) {CompanyEntity c=em.find(CompanyEntity.class,id,LockModeType.PESSIMISTIC_READ);if(c==null)throw ApiException.missing();return c;}
 private Company companyView(CompanyEntity c) {
  List<MonthlyFinancial> rows=em.createQuery("from MonthlyFinancialEntity where companyId=:id order by month",MonthlyFinancialEntity.class).setParameter("id",c.id).getResultList().stream().map(f->new MonthlyFinancial(f.month,f.revenueRub,f.operatingExpensesRub)).toList();
  return new Company(c.id,c.inn,c.name,c.operatingMonths,c.cashBalanceRub,c.existingDebtMonthlyRub,c.latePaymentsLast12m,c.taxDebtRub,c.isActive,c.financialsVersion,rows);
 }
 private CreditProduct productView(CreditProductEntity p) {return new CreditProduct(p.id,p.name,p.annualRatePct,p.minAmountRub,p.maxAmountRub,Arrays.stream(p.allowedTermsMonths.split(",")).map(Integer::valueOf).toList());}
 public List<CreditProduct> products() {return inTx(()->em.createQuery("from CreditProductEntity order by id",CreditProductEntity.class).getResultList().stream().map(this::productView).toList());}
 public Company company(UserEntity u) {role(u,Role.ENTREPRENEUR);return inTx(()->companyView(lockedCompany(u.companyId)));}
 public static List<MonthlyFinancial> validatedMonths(List<MonthlyFinancial> months) {
  if(months==null || months.size()!=12)throw ApiException.validation("Требуется ровно 12 последовательных месяцев");
  List<MonthlyFinancial> sorted=months.stream().sorted(Comparator.comparing(MonthlyFinancial::month)).toList();
  try {
   YearMonth first=YearMonth.parse(sorted.getFirst().month());
   for(int i=0;i<12;i++)if(!YearMonth.parse(sorted.get(i).month()).equals(first.plusMonths(i)))throw ApiException.validation("Месяцы должны быть уникальными и последовательными");
  } catch(java.time.DateTimeException e) {throw ApiException.validation("Месяц должен иметь формат YYYY-MM");}
  return sorted;
 }
 public Company updateCompany(UserEntity u,FinancialsUpdateRequest input) {
  role(u,Role.ENTREPRENEUR);List<MonthlyFinancial> rows=validatedMonths(input.financials());
  return inTx(()->{
   CompanyEntity c=em.find(CompanyEntity.class,u.companyId,LockModeType.PESSIMISTIC_WRITE);if(c==null)throw ApiException.missing();
   c.cashBalanceRub=input.cashBalanceRub();c.existingDebtMonthlyRub=input.existingDebtMonthlyRub();c.financialsVersion++;
   em.createQuery("delete from MonthlyFinancialEntity where companyId=:id").setParameter("id",c.id).executeUpdate();
   for(MonthlyFinancial row:rows){MonthlyFinancialEntity f=new MonthlyFinancialEntity();f.companyId=c.id;f.month=row.month();f.revenueRub=row.revenueRub();f.operatingExpensesRub=row.operatingExpensesRub();em.persist(f);}
   em.flush();return companyView(c);
  });
 }
 private CreditProduct validateProduct(LoanParameters p) {
  CreditProduct product=productView(get(CreditProductEntity.class,p.productId()));
  if(p.requestedAmountRub()<product.minAmountRub()||p.requestedAmountRub()>product.maxAmountRub())throw ApiException.validation("Сумма вне лимитов продукта");
  if(!product.allowedTermsMonths().contains(p.termMonths()))throw ApiException.validation("Недопустимый срок продукта");
  return product;
 }
 private static EngineEvaluateRequest engineRequest(Long id,Company c,CreditProduct p,LoanParameters loan) {
  return new EngineEvaluateRequest(id,new EngineProduct(p.id(),p.annualRatePct(),p.minAmountRub(),p.maxAmountRub(),p.allowedTermsMonths()),new EngineCompany(c.operatingMonths(),c.cashBalanceRub(),c.existingDebtMonthlyRub(),c.latePaymentsLast12m(),c.taxDebtRub(),c.isActive(),c.financials()),loan.requestedAmountRub(),loan.termMonths(),loan.projectedRevenueUpliftMonthlyRub(),loan.upliftStartMonth());
 }
 public SimulationResponse simulate(UserEntity u,LoanParameters p) {
  role(u,Role.ENTREPRENEUR);
  EngineEvaluateRequest input=inTx(()->{CreditProduct product=validateProduct(p);Company c=companyView(lockedCompany(u.companyId));validatedMonths(c.financials());return engineRequest(null,c,product,p);});
  return engine.evaluate(input);
 }
 private void assign(LoanApplicationEntity a,ApplicationInput p) {a.productId=p.productId();a.requestedAmountRub=p.requestedAmountRub();a.termMonths=p.termMonths();a.purpose=p.purpose();a.projectedRevenueUpliftMonthlyRub=p.projectedRevenueUpliftMonthlyRub();a.upliftStartMonth=p.upliftStartMonth();a.updatedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
 private LoanParameters parameters(LoanApplicationEntity a) {return new LoanParameters(a.productId,a.requestedAmountRub,a.termMonths,a.projectedRevenueUpliftMonthlyRub,a.upliftStartMonth);}
 private void transition(LoanApplicationEntity a,Status next,Role actor,String comment) {
  ApplicationStatusHistoryEntity h=new ApplicationStatusHistoryEntity();h.applicationId=a.id;h.fromStatus=a.status;h.toStatus=next;h.actorRole=actor;h.comment=comment;h.changedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);em.persist(h);
  a.status=next;a.statusComment=comment;a.updatedAt=h.changedAt;
 }
 public ApplicationView create(UserEntity u,ApplicationInput p) {role(u,Role.ENTREPRENEUR);return inTx(()->{
  validateProduct(p.parameters());LoanApplicationEntity a=new LoanApplicationEntity();a.companyId=u.companyId;a.createdByUserId=u.id;assign(a,p);a.createdAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
  // Insert with DRAFT, then record the initial null -> DRAFT transition.
  a.status=Status.DRAFT;em.persist(a);a.status=null;transition(a,Status.DRAFT,u.role,"Черновик создан");em.flush();return view(a);
 });}
 public ApplicationView edit(UserEntity u,Long id,ApplicationInput p) {return inTx(()->{LoanApplicationEntity a=app(id,true);owner(u,a);if(a.status!=Status.DRAFT&&a.status!=Status.NEEDS_INFO)throw ApiException.conflict();validateProduct(p.parameters());assign(a,p);return view(a);});}
 public ApplicationView find(UserEntity u,Long id) {return inTx(()->{LoanApplicationEntity a=app(id,false);readable(u,a);return view(a);});}
 public List<ApplicationView> list(UserEntity u,boolean bank,Status filter) {role(u,bank?Role.BANK_OFFICER:Role.ENTREPRENEUR);return inTx(()->{
  String q=bank?"from LoanApplicationEntity":"from LoanApplicationEntity where companyId=:company and createdByUserId=:user";
  if(bank&&filter!=null)q+=" where status=:status";q+=" order by createdAt desc,id desc";
  var query=em.createQuery(q,LoanApplicationEntity.class);if(!bank){query.setParameter("company",u.companyId);query.setParameter("user",u.id);}if(bank&&filter!=null)query.setParameter("status",filter);
  return query.getResultList().stream().map(this::view).toList();
 });}
 private record Pending(Long snapshotId,EngineEvaluateRequest request) {}
 public ApplicationView submit(UserEntity u,Long id,boolean resubmit) {
  Pending pending=inTx(()->{
   LoanApplicationEntity a=app(id,true);owner(u,a);
   if(resubmit?a.status!=Status.NEEDS_INFO:(a.status!=Status.DRAFT&&a.status!=Status.CHECKING))throw ApiException.conflict();
   if(a.status==Status.CHECKING){ApplicationSnapshotEntity existing=get(ApplicationSnapshotEntity.class,a.activeSnapshotId);return new Pending(existing.id,json.read(existing.engineRequestJson,EngineEvaluateRequest.class));}
   CreditProduct product=validateProduct(parameters(a));
   // Serialize with financial updates so snapshot rows and balances share one version.
   CompanyEntity entity=em.find(CompanyEntity.class,a.companyId,LockModeType.PESSIMISTIC_READ);Company company=companyView(entity);
   a.submittedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);transition(a,Status.CHECKING,u.role,"Синтетические проверки и расчёт");
   ApplicationSnapshotEntity snap=new ApplicationSnapshotEntity();snap.applicationId=a.id;snap.capturedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);snap.companyAndFinancialsSnapshotJson=json.write(company);snap.productSnapshotJson=json.write(product);
   EngineEvaluateRequest request=engineRequest(a.id,company,product,parameters(a));snap.engineRequestJson=json.write(request);em.persist(snap);em.flush();a.activeSnapshotId=snap.id;
   try {validatedMonths(company.financials());} catch(ApiException invalid) {transition(a,Status.NEEDS_INFO,u.role,"Необходимы 12 последовательных месяцев финансовых данных");return null;}
   return new Pending(snap.id,request);
  });
  if(pending==null)return find(u,id);
  // This call intentionally occurs after CHECKING and snapshot have committed.
  SimulationResponse result=engine.evaluate(pending.request());
  return inTx(()->{
   LoanApplicationEntity a=app(id,true);owner(u,a);
   if(!Objects.equals(a.activeSnapshotId,pending.snapshotId()))throw ApiException.conflict();
   List<ScoringResultEntity> existing=em.createQuery("from ScoringResultEntity where snapshotId=:id",ScoringResultEntity.class).setParameter("id",pending.snapshotId()).getResultList();
   if(!existing.isEmpty())return view(a); // Concurrent retry already persisted this evaluation.
   if(a.status!=Status.CHECKING)throw ApiException.conflict();
   ScoringResultEntity s=new ScoringResultEntity();s.applicationId=a.id;s.snapshotId=pending.snapshotId();s.score=result.score();s.riskLevel=result.riskLevel();s.recommendation=result.recommendation();s.dscr=result.dscr();s.monthlyPaymentRub=result.monthlyPaymentRub();s.factorsJson=json.write(result.factors());s.fullResultJson=json.write(result);s.evaluatedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);em.persist(s);
   transition(a,Status.UNDER_REVIEW,u.role,"Проверки завершены. Окончательное решение принимает сотрудник банка");em.flush();return view(a);
  });
 }
 public ApplicationView decide(UserEntity u,Long id,BankDecisionRequest p) {role(u,Role.BANK_OFFICER);return inTx(()->{
  LoanApplicationEntity a=app(id,true);if(a.status!=Status.UNDER_REVIEW)throw ApiException.conflict();
  CreditDecisionEntity d=new CreditDecisionEntity();d.applicationId=a.id;d.decision=p.decision();d.comment=p.comment();d.decidedByUserId=u.id;d.decidedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
  Status next;
  if(p.decision()==Decision.APPROVE){
   if(p.offeredAmountRub()==null||p.offeredTermMonths()==null)throw ApiException.validation("Укажите сумму и срок предложения");
   if(p.offeredAmountRub()>a.requestedAmountRub)throw ApiException.validation("Сумма предложения превышает запрошенную");
   CreditProduct product=validateProduct(new LoanParameters(a.productId,p.offeredAmountRub(),p.offeredTermMonths(),0L,1));
   d.offeredAmountRub=p.offeredAmountRub();d.offeredTermMonths=p.offeredTermMonths();d.offeredAnnualRatePct=product.annualRatePct();next=Status.OFFERED;
  }else{
   if(p.offeredAmountRub()!=null||p.offeredTermMonths()!=null)throw ApiException.validation("Параметры предложения допустимы только для APPROVE");
   next=p.decision()==Decision.DECLINE?Status.DECLINED:Status.NEEDS_INFO;
  }
  em.persist(d);transition(a,next,u.role,p.comment());em.flush();return view(a);
 });}
 public ApplicationView accept(UserEntity u,Long id) {return inTx(()->{LoanApplicationEntity a=app(id,true);owner(u,a);if(a.status!=Status.OFFERED)throw ApiException.conflict();transition(a,Status.ACCEPTED,u.role,"Условия демонстрационного предложения приняты");return view(a);});}
 public ApplicationView disburse(UserEntity u,Long id) {role(u,Role.BANK_OFFICER);return inTx(()->{LoanApplicationEntity a=app(id,true);if(a.status!=Status.ACCEPTED)throw ApiException.conflict();transition(a,Status.SIMULATED_ISSUED,u.role,"Выдача симулирована. Денежные средства не переводились");return view(a);});}
 private ApplicationView view(LoanApplicationEntity a) {
  CompanyEntity c=get(CompanyEntity.class,a.companyId);
  var history=em.createQuery("from ApplicationStatusHistoryEntity where applicationId=:id order by id",ApplicationStatusHistoryEntity.class).setParameter("id",a.id).getResultList().stream().map(h->new StatusHistory(h.fromStatus,h.toStatus,h.actorRole,h.comment,h.changedAt)).toList();
  CompanySnapshot snapshot=null;
  if(a.activeSnapshotId!=null){ApplicationSnapshotEntity s=get(ApplicationSnapshotEntity.class,a.activeSnapshotId);Company captured=json.read(s.companyAndFinancialsSnapshotJson,Company.class);try {validatedMonths(captured.financials());snapshot=new CompanySnapshot(captured,json.read(s.productSnapshotJson,CreditProduct.class),s.capturedAt);} catch(ApiException incomplete) { /* Keep incomplete internal audit data out of the strict public Company DTO. */ }}
  Scoring scoring=null;
  // Only expose the score matching the current snapshot; an unsuccessful resubmit must not show an old score as new.
  if(a.activeSnapshotId!=null){var scores=em.createQuery("from ScoringResultEntity where snapshotId=:id",ScoringResultEntity.class).setParameter("id",a.activeSnapshotId).getResultList();
   if(!scores.isEmpty()){var s=scores.getFirst();SimulationResponse full=json.read(s.fullResultJson,SimulationResponse.class);scoring=new Scoring(s.score,s.riskLevel,s.recommendation,s.dscr,s.monthlyPaymentRub,full.factors(),s.evaluatedAt);}}
  Offer offer=null;
  if(a.status==Status.OFFERED||a.status==Status.ACCEPTED||a.status==Status.SIMULATED_ISSUED){var decisions=em.createQuery("from CreditDecisionEntity where applicationId=:id and decision=:decision order by id desc",CreditDecisionEntity.class).setParameter("id",a.id).setParameter("decision",Decision.APPROVE).setMaxResults(1).getResultList();if(!decisions.isEmpty()){var d=decisions.getFirst();offer=new Offer(d.offeredAmountRub,d.offeredTermMonths,d.offeredAnnualRatePct,d.comment);}}
  return new ApplicationView(a.id,a.companyId,c.name,c.inn,a.productId,a.requestedAmountRub,a.termMonths,a.projectedRevenueUpliftMonthlyRub,a.upliftStartMonth,a.purpose,a.status,a.createdAt,a.updatedAt,a.submittedAt,a.statusComment,history,scoring,offer,snapshot);
 }
}
