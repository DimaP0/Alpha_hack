package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="application_snapshots")
public class ApplicationSnapshotEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long applicationId; @Column(columnDefinition="text") public String companyAndFinancialsSnapshotJson; @Column(columnDefinition="text") public String productSnapshotJson; @Column(columnDefinition="text") public String engineRequestJson; public Instant capturedAt;
}
