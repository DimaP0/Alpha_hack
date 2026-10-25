package ru.alfa.navigator.common;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
@Component
public class JsonCodec {
 private final ObjectMapper mapper;
 public JsonCodec(ObjectMapper mapper) {this.mapper=mapper;}
 public String write(Object value) {try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("Cannot serialize persisted data",e);}}
 public <T> T read(String value,Class<T> type) {try{return mapper.readValue(value,type);}catch(Exception e){throw new IllegalStateException("Cannot deserialize persisted data",e);}}
}
