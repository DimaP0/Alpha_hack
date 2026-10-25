package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="application_status_history")
public class ApplicationStatusHistoryEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long applicationId; @Enumerated(EnumType.STRING) public Status fromStatus; @Enumerated(EnumType.STRING) public Status toStatus; @Enumerated(EnumType.STRING) public Role actorRole; @Column(columnDefinition="text") public String comment; public Instant changedAt;
}
