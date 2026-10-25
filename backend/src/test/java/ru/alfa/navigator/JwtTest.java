package ru.alfa.navigator;
import org.junit.jupiter.api.Test;
import ru.alfa.navigator.auth.JwtService;
import ru.alfa.navigator.application.UserEntity;
import static org.junit.jupiter.api.Assertions.*;
class JwtTest {
 @Test void issuedTokenHasVerifiedIdentity() {var jwt=new JwtService("synthetic-test-secret-32-bytes-minimum-aaaaaaaa");var user=new UserEntity();user.id=42L;assertEquals(42L,jwt.verify(jwt.issue(user)));}
 @Test void rejectsDifferentSigningKey() {var jwt=new JwtService("synthetic-test-secret-32-bytes-minimum-aaaaaaaa");var other=new JwtService("synthetic-test-secret-32-bytes-minimum-bbbbbbbb");var user=new UserEntity();user.id=42L;assertThrows(io.jsonwebtoken.JwtException.class,()->other.verify(jwt.issue(user)));}
 @Test void rejectsUnsignedToken() {var jwt=new JwtService("synthetic-test-secret-32-bytes-minimum-aaaaaaaa");assertThrows(Exception.class,()->jwt.verify("eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0."));}
}
