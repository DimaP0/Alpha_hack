from decimal import Decimal

import pytest

from app.calculations import displayed_dscr
from app.scoring import classify_risk, dscr_penalty, score_company


@pytest.mark.parametrize("ratio,penalty", [
    ("0", 450), ("0.99999", 450), ("1", 280), ("1.19999", 280),
    ("1.2", 170), ("1.49999", 170), ("1.5", 80), ("1.99999", 80), ("2", 0),
])
def test_dscr_thresholds(ratio, penalty):
    assert dscr_penalty(Decimal(ratio)) == penalty


@pytest.mark.parametrize("score,risk", [(0, "HIGH"), (549, "HIGH"), (550, "MEDIUM"),
                                        (749, "MEDIUM"), (750, "LOW"), (1000, "LOW")])
def test_risk_boundaries(score, risk):
    assert classify_risk(score) == risk


def test_unrounded_dscr_controls_score_and_recommendation(request_model):
    assert displayed_dscr(Decimal("1.49999")) == 1.5
    score, risk, recommendation, _ = score_company(request_model.company, Decimal("1.49999"), Decimal(1_450_000))
    assert (score, risk, recommendation) == (830, "LOW", "MANUAL_REVIEW")


@pytest.mark.parametrize("months,penalty", [(0, 150), (11, 150), (12, 70), (23, 70), (24, 0)])
def test_company_age(request_model, months, penalty):
    request_model.company.operatingMonths = months
    assert score_company(request_model.company, Decimal(3), Decimal(1_450_000))[0] == 1000 - penalty


@pytest.mark.parametrize("late,penalty", [(0, 0), (1, 90), (2, 180), (3, 270), (9, 270)])
def test_late_payment_cap(request_model, late, penalty):
    request_model.company.latePaymentsLast12m = late
    assert score_company(request_model.company, Decimal(3), Decimal(1_450_000))[0] == 1000 - penalty


@pytest.mark.parametrize("negative,penalty", [(0, 0), (1, 35), (5, 175), (6, 210), (12, 210)])
def test_negative_margin_cap(request_model, negative, penalty):
    for row in request_model.company.financials[:negative]:
        row.revenueRub = 0
    assert score_company(request_model.company, Decimal(3), Decimal(1_450_000))[0] == 1000 - penalty


def test_tax_debt_prevents_auto_recommendation(request_model):
    request_model.company.taxDebtRub = 1
    score, risk, recommendation, factors = score_company(request_model.company, Decimal(3), Decimal(1_450_000))
    assert (score, risk, recommendation) == (880, "LOW", "MANUAL_REVIEW")
    assert any(f.code == "TAX_DEBT" and f.impactPoints == -120 for f in factors)


def test_cash_buffer_strict_boundary(request_model):
    request_model.company.cashBalanceRub = 1_570_000
    assert score_company(request_model.company, Decimal(3), Decimal(1_450_000))[0] == 1000
    request_model.company.cashBalanceRub -= 1
    assert score_company(request_model.company, Decimal(3), Decimal(1_450_000))[0] == 930


def test_cash_buffer_uses_exact_three_month_expense_sum(request_model):
    latest = sorted(request_model.company.financials, key=lambda row: row.month)[-3:]
    for row, expense in zip(latest, (1, 1, 2), strict=True):
        row.operatingExpensesRub = expense
    request_model.company.cashBalanceRub = 1
    request_model.company.existingDebtMonthlyRub = 0

    score, _, _, factors = score_company(request_model.company, Decimal(3), Decimal(4) / 3)

    assert score == 930
    assert any(f.code == "LOW_CASH_BUFFER" for f in factors)


def test_inactive_company_declines_even_with_high_score(request_model):
    request_model.company.isActive = False
    score, risk, recommendation, factors = score_company(request_model.company, Decimal(3), Decimal(1_450_000))
    assert (score, risk, recommendation) == (1000, "LOW", "DECLINE")
    assert any(f.code == "INACTIVE_BUSINESS" for f in factors)
    assert any(f.code == "STRONG_CASH_FLOW" and f.impactPoints == 0 for f in factors)


def test_penalties_clip_at_zero(request_model):
    company = request_model.company
    company.cashBalanceRub = 0
    company.taxDebtRub = 1
    company.operatingMonths = 0
    company.latePaymentsLast12m = 20
    for row in company.financials:
        row.revenueRub = 0
    score, risk, recommendation, factors = score_company(company, Decimal(0), Decimal(1_450_000))
    assert (score, risk, recommendation) == (0, "HIGH", "DECLINE")
    assert sum(f.impactPoints for f in factors) == -1270
