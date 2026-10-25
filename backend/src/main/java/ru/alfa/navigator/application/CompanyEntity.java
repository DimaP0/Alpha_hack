package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="companies")
public class CompanyEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public String inn; public String name; public Integer operatingMonths; public Long cashBalanceRub; public Long existingDebtMonthlyRub; public Integer latePaymentsLast12m; public Long taxDebtRub; public boolean isActive; public Long financialsVersion; @Version public long version;
}
