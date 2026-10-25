package ru.alfa.navigator;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
@EnabledIfEnvironmentVariable(named="RUN_DB_TESTS",matches="true")
class LocalPostgresIntegrationTest extends ApiIntegrationSupport {}
