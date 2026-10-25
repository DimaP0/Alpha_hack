import logging
from decimal import localcontext

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.alternatives import alternatives
from app.calculations import displayed_dscr, forecast
from app.schemas import EngineEvaluateRequest, EngineEvaluateResponse, Health
from app.scoring import assess

app = FastAPI(title="ALFA Business Navigator — Financial Engine Internal API", version="1.0.0")
logger = logging.getLogger("financial-engine")


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    # No input payloads, customer data, stack traces, or credentials in responses/logs.
    logger.error('{"event":"evaluation_failed","exceptionType":"%s"}', type(exc).__name__)
    return JSONResponse(status_code=500, content={"code": "INTERNAL_ERROR", "message": "Calculation failed", "details": {}})


@app.get("/internal/v1/health", response_model=Health, operation_id="health")
def health() -> Health:
    return Health(status="ok")


@app.post("/internal/v1/evaluate", response_model=EngineEvaluateResponse, operation_id="evaluate")
def evaluate(request: EngineEvaluateRequest) -> EngineEvaluateResponse:
    with localcontext() as context:
        context.prec = 50
        assessment = assess(request)
        return EngineEvaluateResponse(monthlyPaymentRub=assessment.payment,
                                      dscr=displayed_dscr(assessment.raw_dscr),
                                      score=assessment.score, riskLevel=assessment.risk,
                                      recommendation=assessment.recommendation, factors=assessment.factors,
                                      scenarios=forecast(request, assessment.payment),
                                      alternatives=alternatives(request))
