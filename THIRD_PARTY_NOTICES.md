# Third-party notices

ALFA BUSINESS NAVIGATOR is an independent synthetic demonstration. It is not connected to corporate banking, tax or credit-bureau systems. Product/brand names describe the requested demo; no third-party bank logo, proprietary data or external paid API is bundled.

## Backend

Java21 / Eclipse Temurin runtime; Maven3.9.9; Maven Wrapper3.3.2 (Apache License2.0 headers retained); Spring Boot3.4.10 and its managed Spring Framework, Security, Data JPA, Validation, Jackson, Hibernate, Flyway and PostgreSQL JDBC dependencies; springdoc-openapi2.8.13; JJWT0.12.6. Exact transitive versions are governed by the pinned Spring Boot parent and Maven dependency tree. Spring and most listed Java dependencies use Apache2.0; Hibernate ORM uses LGPL2.1; PostgreSQL JDBC uses BSD2-Clause. Preserve upstream notices when redistributing dependencies.

Test dependencies: JUnit, Mockito, Spring Boot Test and Testcontainers1.20.6 (versions resolved by the pinned Boot BOM). No engine fixture is used in the runtime application; the synthetic mocked response exists only in backend tests.

## Frontend

React/react-dom18.3.1, Ant Design5.24.1, Ant Design Icons5.6.1, TanStack Query5.66.9, React Router6.30.1, Recharts2.15.1. Tooling includes TypeScript5.7.3, Vite6.1.0, Vitest3.0.5, Testing Library, ESLint and Prettier. Most packages are MIT; TypeScript is Apache2.0. `frontend/package-lock.json` records the complete dependency graph and package metadata. Final runtime uses real HTTP; test fixtures are isolated to tests.

## Financial engine and infrastructure

Python3.12, FastAPI0.115.6, Pydantic2.10.4, Uvicorn0.34.0, pytest8.3.4, HTTPX0.28.1, jsonschema4.23.0, PyYAML6.0.2, plus exact transitive pins in `financial-engine/requirements.txt`. FastAPI and Pydantic use MIT; Uvicorn and HTTPX use BSD3-Clause; Python uses PSF licensing. PostgreSQL16.15 uses the PostgreSQL License. Container images carry their own upstream OS/package licenses.

## Data and calculations

All company records, user identities, passwords, financial histories, credit products, tax status and payment histories are authored synthetic fixtures. There are no real customer datasets, external credit bureaus, trained ML weights or paid LLM services. Financial formulas and deterministic scoring rules come from the supplied frozen project specification. Forecasts and alternatives are simulations, never binding credit offers.

This inventory identifies principal components. For redistribution, retain full dependency licenses supplied in packages/images; it is not a substitute for those license texts.
