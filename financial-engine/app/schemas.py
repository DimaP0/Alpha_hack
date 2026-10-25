"""Frozen internal API models; input cannot contain persistence or status fields."""
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, WithJsonSchema, field_validator, model_validator

NonNegativeInt = Annotated[int, Field(ge=0, strict=True)]
PositiveInt = Annotated[int, Field(ge=1, strict=True)]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
Recommendation = Literal["APPROVE", "MANUAL_REVIEW", "DECLINE"]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class MonthlyFinancial(ContractModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    revenueRub: NonNegativeInt
    operatingExpensesRub: NonNegativeInt


class EngineProduct(ContractModel):
    id: PositiveInt
    annualRatePct: Annotated[Decimal, WithJsonSchema({"type": "number", "minimum": 0})] = Field(ge=0)
    minAmountRub: PositiveInt
    maxAmountRub: PositiveInt
    allowedTermsMonths: list[PositiveInt] = Field(min_length=1)

    @field_validator("annualRatePct", mode="before")
    @classmethod
    def numeric_rate(cls, value):
        if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
            raise ValueError("annualRatePct must be a JSON number")
        return Decimal(str(value))

    @model_validator(mode="after")
    def coherent_limits(self) -> Self:
        if self.maxAmountRub < self.minAmountRub:
            raise ValueError("maxAmountRub must be at least minAmountRub")
        return self


class EngineCompany(ContractModel):
    operatingMonths: NonNegativeInt
    cashBalanceRub: NonNegativeInt
    existingDebtMonthlyRub: NonNegativeInt
    latePaymentsLast12m: NonNegativeInt
    taxDebtRub: NonNegativeInt
    isActive: Annotated[bool, Field(strict=True)]
    financials: list[MonthlyFinancial] = Field(min_length=12, max_length=12)

    @field_validator("financials")
    @classmethod
    def consecutive_months(cls, rows):
        ordered = sorted(rows, key=lambda row: row.month)
        indexes = [int(row.month[:4]) * 12 + int(row.month[5:]) - 1 for row in ordered]
        if any(right - left != 1 for left, right in zip(indexes, indexes[1:])):
            raise ValueError("financials must contain 12 unique consecutive months")
        return ordered


class EngineEvaluateRequest(ContractModel):
    applicationId: PositiveInt | None
    product: EngineProduct
    company: EngineCompany
    requestedAmountRub: PositiveInt
    termMonths: PositiveInt
    projectedRevenueUpliftMonthlyRub: NonNegativeInt
    upliftStartMonth: Annotated[int, Field(ge=1, le=12, strict=True)]

    @model_validator(mode="after")
    def product_constraints(self) -> Self:
        if not self.product.minAmountRub <= self.requestedAmountRub <= self.product.maxAmountRub:
            raise ValueError("requestedAmountRub is outside product limits")
        if self.termMonths not in self.product.allowedTermsMonths:
            raise ValueError("termMonths is not allowed by product")
        return self


class RiskFactor(ContractModel):
    code: str
    message: str
    impactPoints: int


class MonthPoint(ContractModel):
    monthIndex: PositiveInt
    revenueRub: NonNegativeInt
    operatingExpensesRub: NonNegativeInt
    debtPaymentRub: NonNegativeInt
    netCashFlowRub: int
    cashEndRub: int


class Scenario(ContractModel):
    name: Literal["BASE", "STRESS_15", "STRESS_30"]
    minCashBalanceRub: int
    negativeCashMonths: NonNegativeInt
    months: list[MonthPoint] = Field(min_length=12, max_length=12)


class Alternative(ContractModel):
    requestedAmountRub: PositiveInt
    termMonths: PositiveInt
    monthlyPaymentRub: NonNegativeInt
    dscr: float
    score: NonNegativeInt
    riskLevel: RiskLevel


class EngineEvaluateResponse(ContractModel):
    monthlyPaymentRub: NonNegativeInt
    dscr: float
    score: NonNegativeInt
    riskLevel: RiskLevel
    recommendation: Recommendation
    factors: list[RiskFactor]
    scenarios: list[Scenario] = Field(min_length=3, max_length=3)
    alternatives: list[Alternative] = Field(min_length=0, max_length=3)


class Health(ContractModel):
    status: Literal["ok"]
