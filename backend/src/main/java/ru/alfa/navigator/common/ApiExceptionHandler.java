package ru.alfa.navigator.common;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.security.access.AccessDeniedException;
import jakarta.validation.ConstraintViolationException;
import java.util.*;
@RestControllerAdvice
public class ApiExceptionHandler {
 @ExceptionHandler(ApiException.class) public ResponseEntity<Api.ApiError> api(ApiException e) {return ResponseEntity.status(e.status).body(new Api.ApiError(e.code,e.getMessage(),Map.of()));}
 @ExceptionHandler(MethodArgumentNotValidException.class) public ResponseEntity<Api.ApiError> invalid(MethodArgumentNotValidException e) {
  Map<String,Object> details=new LinkedHashMap<>();e.getBindingResult().getFieldErrors().forEach(f->details.put(f.getField(),f.getDefaultMessage()));
  return ResponseEntity.badRequest().body(new Api.ApiError("VALIDATION_ERROR","Проверьте поля запроса",details));
 }
 @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class,ConstraintViolationException.class}) public ResponseEntity<Api.ApiError> malformed(Exception e) {return api(ApiException.validation("Некорректный формат запроса"));}
 @ExceptionHandler(AccessDeniedException.class) public ResponseEntity<Api.ApiError> denied(Exception e) {return api(ApiException.forbidden());}
 @ExceptionHandler(ConcurrencyFailureException.class) public ResponseEntity<Api.ApiError> concurrency(Exception e) {return api(new ApiException(409,"CONCURRENT_UPDATE","Объект уже изменён. Обновите страницу"));}
 @ExceptionHandler(NoResourceFoundException.class) public ResponseEntity<Api.ApiError> missing(Exception e) {return api(ApiException.missing());}
 @ExceptionHandler(Exception.class) public ResponseEntity<Api.ApiError> unexpected(Exception e) {
  org.slf4j.LoggerFactory.getLogger(getClass()).error("Unhandled request failure: {}",e.getClass().getSimpleName());
  return api(new ApiException(500,"INTERNAL_ERROR","Внутренняя ошибка сервера"));
 }
}
