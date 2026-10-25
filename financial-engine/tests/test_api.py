import copy
import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft4Validator
from fastapi.testclient import TestClient

from app.main import app
from conftest import FIXTURES

CONTRACT = yaml.safe_load((Path(__file__).resolve().parents[2] / "contracts" / "financial-engine-api.yaml").read_text(encoding="utf-8"))


def resolved_schema(name):
    def resolve(node):
        if isinstance(node, list):
            return [resolve(item) for item in node]
        if isinstance(node, dict):
            if "$ref" in node:
                return resolve(CONTRACT["components"]["schemas"][node["$ref"].split("/")[-1]])
            result = {key: resolve(value) for key, value in node.items() if key != "nullable"}
            if node.get("nullable"):
                result["type"] = [result["type"], "null"]
            return result
        return node
    return resolve(CONTRACT["components"]["schemas"][name])


def test_health(client):
    response = client.get("/internal/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_golden_request_response_and_frozen_contract(client, payload):
    Draft4Validator(resolved_schema("EngineEvaluateRequest")).validate(payload)
    response = client.post("/internal/v1/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    Draft4Validator(resolved_schema("EngineEvaluateResponse")).validate(data)
    assert data == json.loads((FIXTURES / "evaluate-response.json").read_text(encoding="utf-8"))
    assert (data["monthlyPaymentRub"], data["dscr"], data["score"], data["riskLevel"], data["recommendation"]) == (111491, 2.81, 1000, "LOW", "APPROVE")
    assert data["scenarios"][0]["months"][-1]["cashEndRub"] == 8_172_108


def test_application_id_and_order_do_not_change_result(client, payload):
    simulation = client.post("/internal/v1/evaluate", json=payload).json()
    payload["applicationId"] = 12
    payload["company"]["financials"].reverse()
    assert client.post("/internal/v1/evaluate", json=payload).json() == simulation


def test_backend_seed_golden_fixture(client):
    payload = json.loads((FIXTURES / "seed-request.json").read_text(encoding="utf-8"))
    expected = json.loads((FIXTURES / "seed-response.json").read_text(encoding="utf-8"))
    response = client.post("/internal/v1/evaluate", json=payload)
    assert response.status_code == 200
    assert response.json() == expected
    assert (expected["monthlyPaymentRub"], expected["dscr"], expected["score"]) == (111491, 2.81, 1000)
    payload["applicationId"] = 1
    assert client.post("/internal/v1/evaluate", json=payload).json() == expected


@pytest.mark.parametrize("path,value", [
    (("requestedAmountRub",), 0), (("requestedAmountRub",), 10_000_001),
    (("requestedAmountRub",), True), (("requestedAmountRub",), "3000000"),
    (("termMonths",), 13), (("upliftStartMonth",), 0), (("upliftStartMonth",), 13),
    (("projectedRevenueUpliftMonthlyRub",), -1), (("applicationId",), 0),
    (("company", "cashBalanceRub"), -1), (("company", "isActive"), "true"),
    (("company", "operatingMonths"), -1), (("company", "existingDebtMonthlyRub"), -1),
    (("company", "latePaymentsLast12m"), -1), (("company", "taxDebtRub"), -1),
    (("product", "annualRatePct"), -1), (("product", "annualRatePct"), "20"),
    (("product", "allowedTermsMonths"), []), (("product", "maxAmountRub"), 1),
    (("company", "financials", 0, "revenueRub"), -1),
    (("company", "financials", 0, "operatingExpensesRub"), 1.5),
    (("company", "financials", 0, "month"), "2025-13"),
    (("company", "financials", 0, "month"), "2025-11"),
    (("company", "financials", 0, "month"), "2025-01"),
])
def test_invalid_requests(client, payload, path, value):
    parent = payload
    for key in path[:-1]:
        parent = parent[key]
    parent[path[-1]] = value
    response = client.post("/internal/v1/evaluate", json=payload)
    assert response.status_code == 422
    assert "detail" in response.json()


@pytest.mark.parametrize("path", [(), ("company",), ("product",), ("company", "financials", 0)])
def test_unknown_fields_rejected(client, payload, path):
    parent = payload
    for key in path:
        parent = parent[key]
    parent["unexpected"] = 1
    assert client.post("/internal/v1/evaluate", json=payload).status_code == 422


def test_twelve_months_required_and_nullable_id_required(client, payload):
    missing_id = copy.deepcopy(payload)
    del missing_id["applicationId"]
    assert client.post("/internal/v1/evaluate", json=missing_id).status_code == 422
    payload["company"]["financials"].pop()
    assert client.post("/internal/v1/evaluate", json=payload).status_code == 422


def test_zero_financials_and_zero_rate(client, payload):
    payload["product"]["annualRatePct"] = 0
    payload["company"]["cashBalanceRub"] = 0
    payload["company"]["existingDebtMonthlyRub"] = 0
    for row in payload["company"]["financials"]:
        row["revenueRub"] = row["operatingExpensesRub"] = 0
    response = client.post("/internal/v1/evaluate", json=payload)
    assert response.status_code == 200
    assert response.json()["dscr"] == 0
    assert response.json()["monthlyPaymentRub"] == 83333


def test_error_does_not_leak_internal_exception(payload, monkeypatch):
    def broken(_):
        raise RuntimeError("synthetic-sensitive-internal-value")
    monkeypatch.setattr("app.main.assess", broken)
    response = TestClient(app, raise_server_exceptions=False).post("/internal/v1/evaluate", json=payload)
    assert response.status_code == 500
    assert "synthetic-sensitive-internal-value" not in response.text
    assert response.json()["code"] == "INTERNAL_ERROR"


def test_generated_openapi_fields_and_enums_match_contract(client):
    generated = client.get("/openapi.json").json()
    assert set(generated["paths"]) == set(CONTRACT["paths"])
    for name, frozen in CONTRACT["components"]["schemas"].items():
        actual = generated["components"]["schemas"][name]
        assert set(actual["properties"]) == set(frozen["properties"]), name
        assert set(actual["required"]) == set(frozen["required"]), name
        assert actual["additionalProperties"] is False
        for field, schema in frozen["properties"].items():
            if field == "annualRatePct":
                assert actual["properties"][field]["type"] == "number"
                assert "anyOf" not in actual["properties"][field]
            if "enum" in schema:
                emitted = actual["properties"][field]
                assert emitted.get("enum", [emitted.get("const")]) == schema["enum"]
