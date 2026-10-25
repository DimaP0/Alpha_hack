package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="loan_applications")
public class LoanApplicationEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long companyId; public Long createdByUserId; public Long productId; public Long requestedAmountRub; public Integer termMonths; @Enumerated(EnumType.STRING) public Purpose purpose; public Long projectedRevenueUpliftMonthlyRub; public Integer upliftStartMonth; @Enumerated(EnumType.STRING) public Status status; public Instant createdAt; public Instant updatedAt; public Instant submittedAt; @Column(columnDefinition="text") public String statusComment; public Long activeSnapshotId; @Version public long version;
}
