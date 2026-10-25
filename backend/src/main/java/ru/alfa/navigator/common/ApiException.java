package ru.alfa.navigator.common;
public class ApiException extends RuntimeException {
 public final int status; public final String code;
 public ApiException(int status,String code,String message) { super(message);this.status=status;this.code=code; }
 public static ApiException validation(String message) {return new ApiException(400,"VALIDATION_ERROR",message);}
 public static ApiException conflict() {return new ApiException(409,"INVALID_STATE_TRANSITION","Действие недоступно в текущем статусе заявки");}
 public static ApiException forbidden() {return new ApiException(403,"FORBIDDEN","Недостаточно прав");}
 public static ApiException missing() {return new ApiException(404,"NOT_FOUND","Объект не найден");}
 public static ApiException engine() {return new ApiException(503,"ENGINE_UNAVAILABLE","Финансовый движок недоступен. Повторите проверку позднее");}
}
