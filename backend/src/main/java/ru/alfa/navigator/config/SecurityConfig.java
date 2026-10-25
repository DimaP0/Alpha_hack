package ru.alfa.navigator.config;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import ru.alfa.navigator.auth.JwtFilter;
import ru.alfa.navigator.common.Api.ApiError;
import java.util.*;
@Configuration
public class SecurityConfig {
 @Bean PasswordEncoder passwordEncoder() {return new BCryptPasswordEncoder();}
 @Bean SecurityFilterChain security(HttpSecurity http,JwtFilter filter,ObjectMapper mapper) throws Exception {
  http.csrf(c->c.disable()).cors(c->{}).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
   .authorizeHttpRequests(a->a.requestMatchers("/api/v1/auth/login","/actuator/health","/swagger-ui.html","/swagger-ui/**","/v3/api-docs/**").permitAll()
    .requestMatchers("/api/v1/bank/**").hasRole("BANK_OFFICER")
    .requestMatchers("/api/v1/companies/**","/api/v1/simulations").hasRole("ENTREPRENEUR")
    .anyRequest().authenticated())
   .exceptionHandling(e->e.authenticationEntryPoint((req,res,ex)->{res.setStatus(401);res.setContentType("application/json;charset=UTF-8");mapper.writeValue(res.getOutputStream(),new ApiError("UNAUTHENTICATED","Требуется вход в систему",Map.of()));})
    .accessDeniedHandler((req,res,ex)->{res.setStatus(403);res.setContentType("application/json;charset=UTF-8");mapper.writeValue(res.getOutputStream(),new ApiError("FORBIDDEN","Недостаточно прав",Map.of()));}))
   .addFilterBefore(filter,UsernamePasswordAuthenticationFilter.class);
  return http.build();
 }
 @Bean CorsConfigurationSource cors(@Value("${app.cors-allowed-origins}") String origins) {
  CorsConfiguration config=new CorsConfiguration();config.setAllowedOrigins(Arrays.asList(origins.split(",")));config.setAllowedMethods(List.of("GET","POST","PUT","OPTIONS"));config.setAllowedHeaders(List.of("Authorization","Content-Type"));
  UrlBasedCorsConfigurationSource source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",config);return source;
 }
}
