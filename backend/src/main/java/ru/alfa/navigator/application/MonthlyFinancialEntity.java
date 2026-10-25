package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="monthly_financials")
public class MonthlyFinancialEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long companyId; public String month; public Long revenueRub; public Long operatingExpensesRub;
}
