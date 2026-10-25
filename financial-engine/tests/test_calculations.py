from decimal import Decimal

import pytest

from app.calculations import annuity, baseline, displayed_dscr, dscr, request_dscr, rubles


@pytest.mark.parametrize("principal,rate,term,expected", [
    (3_000_000, "20", 36, 111491), (1200, "0", 12, 100),
    (5, "0", 2, 3), (1_000_000_000, "20", 36, 37163583),
    (1200, "0.000000000000000000000000000000000000000000000001", 12, 100),
])
def test_annuity(principal, rate, term, expected):
    assert annuity(principal, Decimal(rate), term) == expected


@pytest.mark.parametrize("value,expected", [("1.5", 2), ("2.5", 3), ("-1.5", -2)])
def test_half_up(value, expected):
    assert rubles(Decimal(value)) == expected


@pytest.mark.parametrize("principal,rate,term", [(0, "20", 36), (100, "-1", 12), (1, "0", 0)])
def test_invalid_pure_annuity(principal, rate, term):
    with pytest.raises(ValueError):
        annuity(principal, Decimal(rate), term)


def test_zero_profit_and_zero_debt():
    assert dscr(Decimal(10), Decimal(20), 0, 0) == 0
    assert dscr(Decimal(10), Decimal(0), 0, 0) == 10
    assert displayed_dscr(Decimal("1.995")) == 2


def test_baseline_uses_chronological_latest_three(request_model):
    company = request_model.company.model_copy(deep=True)
    company.financials[0].revenueRub = 999_999_999
    company.financials.reverse()
    assert baseline(company) == (Decimal(2_100_000), Decimal(1_450_000))


def test_amount_monotonicity():
    payments = [annuity(amount, Decimal(20), 36) for amount in (1_800_000, 2_400_000, 3_000_000)]
    assert payments == sorted(payments)
    ratios = [dscr(Decimal(2_100_000), Decimal(1_450_000), 120_000, payment) for payment in payments]
    assert ratios == sorted(ratios, reverse=True)


def test_annuity_supports_large_positive_rate_exponent():
    assert annuity(1200, Decimal("1e100"), 12) == 10 ** 100


def test_request_dscr_uses_exact_three_month_sums(request_model):
    latest = sorted(request_model.company.financials, key=lambda row: row.month)[-3:]
    for row, margin in zip(latest, (10, 10, 11), strict=True):
        row.revenueRub = margin
        row.operatingExpensesRub = 0
    request_model.company.existingDebtMonthlyRub = 0

    assert request_dscr(request_model, payment=10) == Decimal(31) / Decimal(30)
