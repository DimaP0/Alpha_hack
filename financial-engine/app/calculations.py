"""Pure Decimal arithmetic. Financial inputs and outputs are synthetic rubles."""
from decimal import Decimal, ROUND_HALF_UP, localcontext

from app.schemas import EngineCompany, EngineEvaluateRequest, MonthPoint, Scenario


def rubles(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def displayed_dscr(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def annuity(principal: int, annual_rate_pct: Decimal, term_months: int) -> int:
    if principal <= 0 or term_months <= 0 or annual_rate_pct < 0 or not annual_rate_pct.is_finite():
        raise ValueError("Invalid loan parameters")
    with localcontext() as context:
        # Preserve accuracy for very small rates and rates with large positive exponents.
        context.prec = max(
            60,
            len(str(principal)) + len(str(term_months)) + len(annual_rate_pct.as_tuple().digits)
            + max(0, annual_rate_pct.adjusted() + 1) + max(0, -annual_rate_pct.adjusted()) + 20,
        )
        rate = annual_rate_pct / Decimal(1200)
        payment = (Decimal(principal) / term_months if rate == 0 else
                   Decimal(principal) * rate / (1 - (1 + rate) ** (-term_months)))
        return rubles(payment)


def baseline(company: EngineCompany) -> tuple[Decimal, Decimal]:
    latest = sorted(company.financials, key=lambda row: row.month)[-3:]
    return (Decimal(sum(row.revenueRub for row in latest)) / 3,
            Decimal(sum(row.operatingExpensesRub for row in latest)) / 3)


def dscr(revenue: Decimal, expenses: Decimal, existing_debt: int, payment: int) -> Decimal:
    return max(Decimal(0), revenue - expenses) / max(1, existing_debt + payment)


def request_dscr(request: EngineEvaluateRequest, payment: int) -> Decimal:
    """Calculate DSCR from exact recent-month integer sums for threshold checks."""
    latest = sorted(request.company.financials, key=lambda row: row.month)[-3:]
    margin_sum = max(0, sum(row.revenueRub - row.operatingExpensesRub for row in latest))
    debt_service = max(1, request.company.existingDebtMonthlyRub + payment)
    return Decimal(margin_sum) / Decimal(3 * debt_service)


def forecast(request: EngineEvaluateRequest, payment: int) -> list[Scenario]:
    revenue, expenses = baseline(request.company)
    debt = request.company.existingDebtMonthlyRub + payment
    rounded_expenses = rubles(expenses)
    scenarios = []
    for name, stress in (("BASE", Decimal(0)), ("STRESS_15", Decimal("0.15")),
                         ("STRESS_30", Decimal("0.30"))):
        cash = request.company.cashBalanceRub
        months = []
        for index in range(1, 13):
            uplift = request.projectedRevenueUpliftMonthlyRub if index >= request.upliftStartMonth else 0
            rounded_revenue = rubles(revenue * (1 - stress) + uplift)
            net = rounded_revenue - rounded_expenses - debt
            cash += net
            months.append(MonthPoint(monthIndex=index, revenueRub=rounded_revenue,
                                     operatingExpensesRub=rounded_expenses, debtPaymentRub=debt,
                                     netCashFlowRub=net, cashEndRub=cash))
        scenarios.append(Scenario(name=name, months=months,
                                  minCashBalanceRub=min(month.cashEndRub for month in months),
                                  negativeCashMonths=sum(month.cashEndRub < 0 for month in months)))
    return scenarios
