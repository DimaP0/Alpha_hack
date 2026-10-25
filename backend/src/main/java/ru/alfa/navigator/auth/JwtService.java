package ru.alfa.navigator.auth;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.alfa.navigator.application.UserEntity;
@Service
public class JwtService {
 private final SecretKey key;
 public JwtService(@Value("${app.jwt-secret}") String secret) {key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));}
 public String issue(UserEntity user) {Instant now=Instant.now();return Jwts.builder().issuer("alfa-business-navigator-demo").subject(user.id.toString()).issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(3600))).signWith(key).compact();}
 public Long verify(String token) {return Long.valueOf(Jwts.parser().verifyWith(key).requireIssuer("alfa-business-navigator-demo").build().parseSignedClaims(token).getPayload().getSubject());}
}
