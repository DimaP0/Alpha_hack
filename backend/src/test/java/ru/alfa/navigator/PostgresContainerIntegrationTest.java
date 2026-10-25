package ru.alfa.navigator;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
@Testcontainers(disabledWithoutDocker=true)
class PostgresContainerIntegrationTest extends ApiIntegrationSupport {
 @Container static final PostgreSQLContainer<?> postgres=new PostgreSQLContainer<>("postgres:16.15-alpine");
 @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {r.add("spring.datasource.url",postgres::getJdbcUrl);r.add("spring.datasource.username",postgres::getUsername);r.add("spring.datasource.password",postgres::getPassword);}
}
