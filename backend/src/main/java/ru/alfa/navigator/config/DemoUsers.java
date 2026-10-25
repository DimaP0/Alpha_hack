package ru.alfa.navigator.config;
import org.springframework.stereotype.Component;
import org.springframework.boot.CommandLineRunner;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.alfa.navigator.user.UserRepository;
import ru.alfa.navigator.application.UserEntity;
import ru.alfa.navigator.common.Api.Role;
@Component
public class DemoUsers implements CommandLineRunner {
 private final UserRepository users; private final PasswordEncoder passwords;
 public DemoUsers(UserRepository users,PasswordEncoder passwords) {this.users=users;this.passwords=passwords;}
 @Override @Transactional public void run(String... args) {
  seed("owner@demo.local","Иван Тестовый",Role.ENTREPRENEUR,1L);
  seed("bank@demo.local","Мария Демо",Role.BANK_OFFICER,null);
  seed("owner2@demo.local","Пётр Тестовый",Role.ENTREPRENEUR,2L);
 }
 private void seed(String email,String name,Role role,Long companyId) {if(users.findByEmail(email).isPresent())return;UserEntity u=new UserEntity();u.email=email;u.fullName=name;u.role=role;u.companyId=companyId;u.passwordHash=passwords.encode("Demo123!");users.save(u);}
}
