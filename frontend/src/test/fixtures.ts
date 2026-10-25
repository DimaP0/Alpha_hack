import type {
  ApplicationView,
  Company,
  CreditProduct,
  SimulationResponse,
} from "../api/contract-types";
export const product: CreditProduct = {
  id: 1,
  name: "Кредит на развитие",
  annualRatePct: 20,
  minAmountRub: 100000,
  maxAmountRub: 10000000,
  allowedTermsMonths: [12, 24, 36, 48, 60],
};
export const company: Company = {
  id: 1,
  name: "ООО Тест",
  inn: "7700000001",
  operatingMonths: 48,
  cashBalanceRub: 1800000,
  existingDebtMonthlyRub: 120000,
  latePaymentsLast12m: 0,
  taxDebtRub: 0,
  isActive: true,
  financialsVersion: 1,
  financials: Array.from({ length: 12 }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, "0")}`,
    revenueRub: 2000000,
    operatingExpensesRub: 1400000,
  })),
};
export const simulation: SimulationResponse = {
  monthlyPaymentRub: 111491,
  dscr: 2.59,
  score: 1000,
  riskLevel: "LOW",
  recommendation: "APPROVE",
  factors: [
    { code: "DSCR", message: "Покрытие долга достаточное", impactPoints: 0 },
  ],
  scenarios: ["BASE", "STRESS_15", "STRESS_30"].map((name, n) => ({
    name: name as "BASE" | "STRESS_15" | "STRESS_30",
    minCashBalanceRub: -100000 * n,
    negativeCashMonths: n,
    months: Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i + 1,
      revenueRub: 2000000,
      operatingExpensesRub: 1400000,
      debtPaymentRub: 231491,
      netCashFlowRub: 368509,
      cashEndRub: 1800000 + i * 100000 - n * 1000000,
    })),
  })),
  alternatives: [
    {
      requestedAmountRub: 2400000,
      termMonths: 36,
      monthlyPaymentRub: 89193,
      dscr: 2.86,
      score: 1000,
      riskLevel: "LOW",
    },
  ],
};
export const application: ApplicationView = {
  id: 1,
  companyId: 1,
  companyName: company.name,
  companyInn: company.inn,
  productId: 1,
  requestedAmountRub: 3000000,
  termMonths: 36,
  purpose: "EQUIPMENT",
  projectedRevenueUpliftMonthlyRub: 150000,
  upliftStartMonth: 4,
  status: "DRAFT",
  createdAt: "2026-10-23T10:00:00Z",
  updatedAt: "2026-10-23T10:00:00Z",
  submittedAt: null,
  statusComment: null,
  history: [
    {
      fromStatus: null,
      toStatus: "DRAFT",
      actorRole: "ENTREPRENEUR",
      comment: null,
      changedAt: "2026-10-23T10:00:00Z",
    },
  ],
  scoring: null,
  offer: null,
  financialSnapshot: null,
};
export const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
