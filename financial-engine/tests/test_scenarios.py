from app.alternatives import alternatives
from app.calculations import forecast
from app.main import evaluate


def test_scenarios_cash_identity_and_stress_order(request_model):
    result = evaluate(request_model)
    assert [s.name for s in result.scenarios] == ["BASE", "STRESS_15", "STRESS_30"]
    for scenario in result.scenarios:
        cash = request_model.company.cashBalanceRub
        assert len(scenario.months) == 12
        for index, month in enumerate(scenario.months, 1):
            assert month.monthIndex == index
            assert month.netCashFlowRub == month.revenueRub - month.operatingExpensesRub - month.debtPaymentRub
            assert month.cashEndRub == cash + month.netCashFlowRub
            cash = month.cashEndRub
        assert scenario.minCashBalanceRub == min(m.cashEndRub for m in scenario.months)
        assert scenario.negativeCashMonths == sum(m.cashEndRub < 0 for m in scenario.months)
    for base, medium, stress in zip(*(s.months for s in result.scenarios)):
        assert base.cashEndRub >= medium.cashEndRub >= stress.cashEndRub


def test_uplift_starts_on_exact_month_and_does_not_change_scoring(request_model):
    result = evaluate(request_model)
    months = result.scenarios[0].months
    assert months[2].revenueRub == 2_100_000
    assert months[3].revenueRub == 2_250_000
    request_model.projectedRevenueUpliftMonthlyRub = 0
    without = evaluate(request_model)
    assert (without.dscr, without.score) == (result.dscr, result.score)
    assert without.scenarios[0].months[0].cashEndRub == 1_800_000 + 2_100_000 - 1_450_000 - 120_000 - result.monthlyPaymentRub


def test_fractional_baseline_rounding_is_cash_conserving(request_model):
    for row in request_model.company.financials:
        row.revenueRub = 101
        row.operatingExpensesRub = 50
    request_model.company.financials[-1].revenueRub = 102
    request_model.company.financials[-1].operatingExpensesRub = 52
    request_model.projectedRevenueUpliftMonthlyRub = 0
    point = forecast(request_model, 0)[0].months[0]
    assert (point.revenueRub, point.operatingExpensesRub) == (101, 51)
    assert point.netCashFlowRub == 101 - 51 - 120_000


def test_negative_cash_and_minimum_excludes_initial_balance(request_model):
    request_model.company.cashBalanceRub = 0
    assert forecast(request_model, 0)[0].minCashBalanceRub > 0
    request_model.company.existingDebtMonthlyRub = 3_000_000
    assert forecast(request_model, 0)[0].negativeCashMonths == 12


def test_alternatives_amounts_and_order(request_model):
    rows = alternatives(request_model)
    assert [row.requestedAmountRub for row in rows] == [3_000_000, 2_400_000, 1_800_000]
    assert all(row.termMonths == 36 for row in rows)
    assert all(not hasattr(row, "alternatives") for row in rows)
    request_model.product.minAmountRub = 2_500_000
    assert len(alternatives(request_model)) == 1


def test_alternatives_deduplicate_and_half_up(request_model):
    request_model.product.minAmountRub = 1
    request_model.requestedAmountRub = 1
    assert [row.requestedAmountRub for row in alternatives(request_model)] == [1]
    request_model.requestedAmountRub = 3
    assert [row.requestedAmountRub for row in alternatives(request_model)] == [3, 2]


def test_alternatives_prioritize_risk_over_amount(request_model):
    request_model.company.existingDebtMonthlyRub = 0
    request_model.company.cashBalanceRub = 10_000_000
    request_model.company.latePaymentsLast12m = 1
    for row in request_model.company.financials:
        row.revenueRub = 1_100_000
        row.operatingExpensesRub = 1_000_000
    rows = alternatives(request_model)
    assert [row.requestedAmountRub for row in rows] == [2_400_000, 1_800_000, 3_000_000]
    assert [row.riskLevel for row in rows] == ["MEDIUM", "MEDIUM", "HIGH"]
