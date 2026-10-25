"""Approved synthetic heuristic, never a final credit decision."""
from dataclasses import dataclass
from decimal import Decimal

from app.calculations import annuity, baseline, request_dscr
from app.schemas import EngineCompany, EngineEvaluateRequest, Recommendation, RiskFactor, RiskLevel


@dataclass(frozen=True)
class Assessment:
    payment: int
    raw_dscr: Decimal
    score: int
    risk: RiskLevel
    recommendation: Recommendation
    factors: list[RiskFactor]


def classify_risk(score: int) -> RiskLevel:
    return "LOW" if score >= 750 else "MEDIUM" if score >= 550 else "HIGH"


def dscr_penalty(ratio: Decimal) -> int:
    for threshold, penalty in (("2", 0), ("1.5", 80), ("1.2", 170), ("1", 280)):
        if ratio >= Decimal(threshold):
            return penalty
    return 450


def score_company(company: EngineCompany, ratio: Decimal, average_expenses: Decimal):
    factors = []

    def factor(code: str, message: str, penalty: int = 0):
        factors.append(RiskFactor(code=code, message=message, impactPoints=-penalty))

    penalty = dscr_penalty(ratio)
    if penalty:
        factor("LOW_DSCR", f"Покрытие долга DSCR {ratio:.4f}; ожидаемый рост выручки не учтён.", penalty)
    else:
        factor("STRONG_CASH_FLOW", "DSCR не ниже 2: текущая операционная маржа покрывает платежи вдвое.")
    negative = sum(row.revenueRub < row.operatingExpensesRub for row in company.financials)
    if negative:
        factor("NEGATIVE_MARGIN_MONTHS", f"Отрицательная операционная маржа: {negative} из 12 месяцев.", min(210, 35 * negative))
    if company.latePaymentsLast12m:
        factor("LATE_PAYMENTS", f"Просрочки за 12 месяцев: {company.latePaymentsLast12m}.", min(270, 90 * company.latePaymentsLast12m))
    if company.operatingMonths < 24:
        factor("YOUNG_BUSINESS", f"Срок работы компании: {company.operatingMonths} месяцев.", 150 if company.operatingMonths < 12 else 70)
    if company.taxDebtRub:
        factor("TAX_DEBT", f"Синтетическая налоговая задолженность: {company.taxDebtRub} ₽.", 120)
    latest = sorted(company.financials, key=lambda row: row.month)[-3:]
    expense_sum = sum(row.operatingExpensesRub for row in latest)
    if 3 * company.cashBalanceRub < expense_sum + 3 * company.existingDebtMonthlyRub:
        factor("LOW_CASH_BUFFER", "Резерв ниже средних месячных расходов и существующих платежей по долгу.", 70)
    if not company.isActive:
        factor("INACTIVE_BUSINESS", "Компания неактивна по синтетической проверке; рекомендация — отказ.")
    score = max(0, min(1000, 1000 + sum(f.impactPoints for f in factors)))
    risk = classify_risk(score)
    recommendation: Recommendation = "MANUAL_REVIEW"
    if risk == "HIGH" or not company.isActive:
        recommendation = "DECLINE"
    elif risk == "LOW" and ratio >= Decimal("1.5") and company.taxDebtRub == 0:
        recommendation = "APPROVE"
    return score, risk, recommendation, factors


def assess(request: EngineEvaluateRequest, amount: int | None = None) -> Assessment:
    payment = annuity(amount if amount is not None else request.requestedAmountRub,
                      request.product.annualRatePct, request.termMonths)
    revenue, expenses = baseline(request.company)
    ratio = request_dscr(request, payment)
    score, risk, recommendation, factors = score_company(request.company, ratio, expenses)
    return Assessment(payment, ratio, score, risk, recommendation, factors)
