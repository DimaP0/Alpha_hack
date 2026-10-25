from decimal import Decimal

from app.calculations import displayed_dscr, rubles
from app.schemas import Alternative, EngineEvaluateRequest
from app.scoring import assess


def alternatives(request: EngineEvaluateRequest) -> list[Alternative]:
    candidates = {rubles(Decimal(request.requestedAmountRub) * fraction)
                  for fraction in (Decimal(1), Decimal("0.8"), Decimal("0.6"))}
    results = []
    for amount in candidates:
        if not request.product.minAmountRub <= amount <= request.product.maxAmountRub:
            continue
        assessment = assess(request, amount)
        results.append(Alternative(requestedAmountRub=amount, termMonths=request.termMonths,
                                   monthlyPaymentRub=assessment.payment,
                                   dscr=displayed_dscr(assessment.raw_dscr),
                                   score=assessment.score, riskLevel=assessment.risk))
    risk_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
    return sorted(results, key=lambda row: (risk_order[row.riskLevel], -row.requestedAmountRub))[:3]
