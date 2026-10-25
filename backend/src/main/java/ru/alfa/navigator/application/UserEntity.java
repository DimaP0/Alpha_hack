package ru.alfa.navigator.application;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import ru.alfa.navigator.common.Api.*;
@Entity @Table(name="users")
public class UserEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public String email; public String passwordHash; public String fullName; @Enumerated(EnumType.STRING) public Role role; public Long companyId;
}
