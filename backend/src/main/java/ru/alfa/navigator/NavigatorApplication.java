package ru.alfa.navigator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(exclude=org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class)
public class NavigatorApplication {
    public static void main(String[] args) { SpringApplication.run(NavigatorApplication.class, args); }
}
