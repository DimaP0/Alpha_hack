import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import EngineEvaluateRequest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def payload():
    return json.loads((FIXTURES / "evaluate-request.json").read_text(encoding="utf-8"))


@pytest.fixture
def request_model(payload):
    return EngineEvaluateRequest.model_validate(copy.deepcopy(payload))


@pytest.fixture
def client():
    return TestClient(app)
