FROM python:3.12-slim
WORKDIR /project
COPY scripts/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY contracts ./contracts
COPY scripts ./scripts
ENTRYPOINT ["python", "scripts/verify_e2e.py"]
