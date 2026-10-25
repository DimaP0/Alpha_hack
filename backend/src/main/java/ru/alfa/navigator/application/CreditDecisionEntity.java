package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="credit_decisions")
public class CreditDecisionEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long applicationId; @Enumerated(EnumType.STRING) public Decision decision; @Column(columnDefinition="text") public String comment; public Long offeredAmountRub; public Integer offeredTermMonths; public BigDecimal offeredAnnualRatePct; public Long decidedByUserId; public Instant decidedAt;
}
