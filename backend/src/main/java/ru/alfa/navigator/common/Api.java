package ru.alfa.navigator.common;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
public final class Api {
 private Api() {}
 public enum Role { ENTREPRENEUR, BANK_OFFICER }
 public enum Status { DRAFT, CHECKING, NEEDS_INFO, UNDER_REVIEW, OFFERED, DECLINED, ACCEPTED, SIMULATED_ISSUED }
 public enum Purpose { EQUIPMENT, WORKING_CAPITAL, EXPANSION }
 public enum Decision { APPROVE, DECLINE, REQUEST_INFO }
 public enum RiskLevel { LOW, MEDIUM, HIGH }
 public enum Recommendation { APPROVE, MANUAL_REVIEW, DECLINE }
 public enum ScenarioName { BASE, STRESS_15, STRESS_30 }
 public record ApiError(String code, String message, Map<String,Object> details) {}
 public record LoginRequest(@NotBlank @Email String email,@NotBlank String password) {}
 public record LoginResponse(String accessToken,String tokenType,Role role,String fullName) {}
 public record MeResponse(Long id,String email,String fullName,Role role,Long companyId) {}
 public record MonthlyFinancial(@NotNull @Pattern(regexp="^[0-9]{4}-(0[1-9]|1[0-2])$") String month,@NotNull @Min(0) Long revenueRub,@NotNull @Min(0) Long operatingExpensesRub) {}
 public record CreditProduct(Long id,String name,BigDecimal annualRatePct,Long minAmountRub,Long maxAmountRub,List<Integer> allowedTermsMonths) {}
 public record Company(Long id,String inn,String name,Integer operatingMonths,Long cashBalanceRub,Long existingDebtMonthlyRub,Integer latePaymentsLast12m,Long taxDebtRub,boolean isActive,Long financialsVersion,List<MonthlyFinancial> financials) {}
 public record FinancialsUpdateRequest(@NotNull @Min(0) Long cashBalanceRub,@NotNull @Min(0) Long existingDebtMonthlyRub,@NotNull @Size(min=12,max=12) List<@NotNull @Valid MonthlyFinancial> financials) {}
 public record LoanParameters(@NotNull @Min(1) Long productId,@NotNull @Min(1) Long requestedAmountRub,@NotNull @Min(1) Integer termMonths,@NotNull @Min(0) Long projectedRevenueUpliftMonthlyRub,@NotNull @Min(1) @Max(12) Integer upliftStartMonth) {}
 public record ApplicationInput(@NotNull @Min(1) Long productId,@NotNull @Min(1) Long requestedAmountRub,@NotNull @Min(1) Integer termMonths,@NotNull @Min(0) Long projectedRevenueUpliftMonthlyRub,@NotNull @Min(1) @Max(12) Integer upliftStartMonth,@NotNull Purpose purpose) {
  public LoanParameters parameters() { return new LoanParameters(productId,requestedAmountRub,termMonths,projectedRevenueUpliftMonthlyRub,upliftStartMonth); }
 }
 public record BankDecisionRequest(@NotNull Decision decision,@NotBlank String comment,@Min(1) Long offeredAmountRub,@Min(1) Integer offeredTermMonths) {}
 public record StatusHistory(Status fromStatus,Status toStatus,Role actorRole,String comment,Instant changedAt) {}
 public record RiskFactor(@NotNull String code,@NotNull String message,@NotNull Integer impactPoints) {}
 public record MonthPoint(@NotNull @Min(1) Integer monthIndex,@NotNull @Min(0) Long revenueRub,@NotNull @Min(0) Long operatingExpensesRub,@NotNull @Min(0) Long debtPaymentRub,@NotNull Long netCashFlowRub,@NotNull Long cashEndRub) {}
 public record Scenario(@NotNull ScenarioName name,@NotNull Long minCashBalanceRub,@NotNull @Min(0) Integer negativeCashMonths,@NotNull @Size(min=12,max=12) List<@NotNull @Valid MonthPoint> months) {}
 public record Alternative(@NotNull @Min(1) Long requestedAmountRub,@NotNull @Min(1) Integer termMonths,@NotNull @Min(0) Long monthlyPaymentRub,@NotNull BigDecimal dscr,@NotNull @Min(0) @Max(1000) Integer score,@NotNull RiskLevel riskLevel) {}
 public record SimulationResponse(@NotNull @Min(0) Long monthlyPaymentRub,@NotNull BigDecimal dscr,@NotNull @Min(0) @Max(1000) Integer score,@NotNull RiskLevel riskLevel,@NotNull Recommendation recommendation,@NotNull List<@NotNull @Valid RiskFactor> factors,@NotNull @Size(min=3,max=3) List<@NotNull @Valid Scenario> scenarios,@NotNull @Size(max=3) List<@NotNull @Valid Alternative> alternatives) {}
 public record Scoring(Integer score,RiskLevel riskLevel,Recommendation recommendation,BigDecimal dscr,Long monthlyPaymentRub,List<RiskFactor> factors,Instant evaluatedAt) {}
 public record Offer(Long amountRub,Integer termMonths,BigDecimal annualRatePct,String comment) {}
 public record CompanySnapshot(Company company,CreditProduct product,Instant capturedAt) {}
 public record ApplicationView(Long id,Long companyId,String companyName,String companyInn,Long productId,Long requestedAmountRub,Integer termMonths,Long projectedRevenueUpliftMonthlyRub,Integer upliftStartMonth,Purpose purpose,Status status,Instant createdAt,Instant updatedAt,Instant submittedAt,String statusComment,List<StatusHistory> history,Scoring scoring,Offer offer,CompanySnapshot financialSnapshot) {}
 public record EngineProduct(Long id,BigDecimal annualRatePct,Long minAmountRub,Long maxAmountRub,List<Integer> allowedTermsMonths) {}
 public record EngineCompany(Integer operatingMonths,Long cashBalanceRub,Long existingDebtMonthlyRub,Integer latePaymentsLast12m,Long taxDebtRub,boolean isActive,List<MonthlyFinancial> financials) {}
 public record EngineEvaluateRequest(Long applicationId,EngineProduct product,EngineCompany company,Long requestedAmountRub,Integer termMonths,Long projectedRevenueUpliftMonthlyRub,Integer upliftStartMonth) {}
}
