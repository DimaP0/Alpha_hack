// Frozen public-api.yaml v1.0 DTOs. All money is integer RUB.
export type Role = "ENTREPRENEUR" | "BANK_OFFICER";
export type Status =
  | "DRAFT"
  | "CHECKING"
  | "NEEDS_INFO"
  | "UNDER_REVIEW"
  | "OFFERED"
  | "DECLINED"
  | "ACCEPTED"
  | "SIMULATED_ISSUED";
export type Risk = "LOW" | "MEDIUM" | "HIGH";
export type Recommendation = "APPROVE" | "MANUAL_REVIEW" | "DECLINE";
export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  role: Role;
  fullName: string;
}
export interface MeResponse {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  companyId: number | null;
}
export interface CreditProduct {
  id: number;
  name: string;
  annualRatePct: number;
  minAmountRub: number;
  maxAmountRub: number;
  allowedTermsMonths: number[];
}
export interface MonthlyFinancial {
  month: string;
  revenueRub: number;
  operatingExpensesRub: number;
}
export interface FinancialsUpdateRequest {
  cashBalanceRub: number;
  existingDebtMonthlyRub: number;
  financials: MonthlyFinancial[];
}
export interface Company extends FinancialsUpdateRequest {
  id: number;
  inn: string;
  name: string;
  operatingMonths: number;
  latePaymentsLast12m: number;
  taxDebtRub: number;
  isActive: boolean;
  financialsVersion: number;
}
export interface LoanParameters {
  productId: number;
  requestedAmountRub: number;
  termMonths: number;
  projectedRevenueUpliftMonthlyRub: number;
  upliftStartMonth: number;
}
export interface ApplicationInput extends LoanParameters {
  purpose: "EQUIPMENT" | "WORKING_CAPITAL" | "EXPANSION";
}
export interface RiskFactor {
  code: string;
  message: string;
  impactPoints: number;
}
export interface MonthPoint {
  monthIndex: number;
  revenueRub: number;
  operatingExpensesRub: number;
  debtPaymentRub: number;
  netCashFlowRub: number;
  cashEndRub: number;
}
export interface Scenario {
  name: "BASE" | "STRESS_15" | "STRESS_30";
  minCashBalanceRub: number;
  negativeCashMonths: number;
  months: MonthPoint[];
}
export interface Alternative {
  requestedAmountRub: number;
  termMonths: number;
  monthlyPaymentRub: number;
  dscr: number;
  score: number;
  riskLevel: Risk;
}
export interface Scoring {
  score: number;
  riskLevel: Risk;
  recommendation: Recommendation;
  dscr: number;
  monthlyPaymentRub: number;
  factors: RiskFactor[];
  evaluatedAt: string;
}
export interface SimulationResponse extends Omit<Scoring, "evaluatedAt"> {
  scenarios: Scenario[];
  alternatives: Alternative[];
}
export interface Offer {
  amountRub: number;
  termMonths: number;
  annualRatePct: number;
  comment: string;
}
export interface StatusHistory {
  fromStatus: string | null;
  toStatus: string;
  actorRole: string;
  comment: string | null;
  changedAt: string;
}
export interface CompanySnapshot {
  company: Company;
  product: CreditProduct;
  capturedAt: string;
}
export interface ApplicationView extends ApplicationInput {
  id: number;
  companyId: number;
  companyName: string;
  companyInn: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  statusComment: string | null;
  history: StatusHistory[];
  scoring: Scoring | null;
  offer: Offer | null;
  financialSnapshot: CompanySnapshot | null;
}
export interface BankDecisionRequest {
  decision: "APPROVE" | "DECLINE" | "REQUEST_INFO";
  comment: string;
  offeredAmountRub?: number;
  offeredTermMonths?: number;
}
