FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --default-timeout=300 --no-cache-dir .

COPY . .

EXPOSE 3007

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3007"]
