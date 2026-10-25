package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="scoring_results")
public class ScoringResultEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long applicationId; public Long snapshotId; public Integer score; @Enumerated(EnumType.STRING) public RiskLevel riskLevel; @Enumerated(EnumType.STRING) public Recommendation recommendation; public BigDecimal dscr; public Long monthlyPaymentRub; @Column(columnDefinition="text") public String factorsJson; @Column(columnDefinition="text") public String fullResultJson; public Instant evaluatedAt;
}
