package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="credit_products")
public class CreditProductEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public String name; public BigDecimal annualRatePct; public Long minAmountRub; public Long maxAmountRub; public String allowedTermsMonths;
}
