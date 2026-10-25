package ru.alfa.navigator.user;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.alfa.navigator.application.UserEntity;
import java.util.Optional;
public interface UserRepository extends JpaRepository<UserEntity,Long> { Optional<UserEntity> findByEmail(String email); }
