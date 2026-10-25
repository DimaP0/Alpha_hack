package ru.alfa.navigator.auth;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import jakarta.validation.Valid;
import ru.alfa.navigator.application.UserEntity;
import ru.alfa.navigator.user.UserRepository;
import ru.alfa.navigator.common.Api.*;
import ru.alfa.navigator.common.ApiException;
@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
 private final UserRepository users;private final PasswordEncoder passwords;private final JwtService jwt;
 public AuthController(UserRepository users,PasswordEncoder passwords,JwtService jwt) {this.users=users;this.passwords=passwords;this.jwt=jwt;}
 @PostMapping("/login") public LoginResponse login(@RequestBody @Valid LoginRequest input) {
  UserEntity u=users.findByEmail(input.email().trim().toLowerCase(java.util.Locale.ROOT)).orElseThrow(()->new ApiException(401,"INVALID_CREDENTIALS","Неверный email или пароль"));
  if(!passwords.matches(input.password(),u.passwordHash)) throw new ApiException(401,"INVALID_CREDENTIALS","Неверный email или пароль");
  return new LoginResponse(jwt.issue(u),"Bearer",u.role,u.fullName);
 }
 @io.swagger.v3.oas.annotations.security.SecurityRequirement(name="bearerAuth")
 @GetMapping("/me") public MeResponse me(@AuthenticationPrincipal UserEntity u) {return new MeResponse(u.id,u.email,u.fullName,u.role,u.companyId);}
}
