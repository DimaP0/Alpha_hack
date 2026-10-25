package ru.alfa.navigator.scoringclient;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.net.http.HttpClient;
import java.time.Duration;
import jakarta.validation.Validator;
import ru.alfa.navigator.common.Api.*;
import ru.alfa.navigator.common.ApiException;
@Component
public class FinancialEngineClient {
 private final RestClient client; private final Validator validator;
 public FinancialEngineClient(@Value("${app.financial-engine-url}") String url,Validator validator,com.fasterxml.jackson.databind.ObjectMapper mapper) {
  this.validator=validator;
  var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).build());factory.setReadTimeout(Duration.ofSeconds(20));
  client=RestClient.builder().baseUrl(url).requestFactory(factory).messageConverters(converters->{converters.removeIf(c->c instanceof org.springframework.http.converter.json.MappingJackson2HttpMessageConverter);converters.add(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(mapper));}).build();
 }
 public SimulationResponse evaluate(EngineEvaluateRequest request) {
  try {
   SimulationResponse result=client.post().uri("/internal/v1/evaluate").contentType(org.springframework.http.MediaType.APPLICATION_JSON).accept(org.springframework.http.MediaType.APPLICATION_JSON).body(request).retrieve().body(SimulationResponse.class);
   if(result==null || !validator.validate(result).isEmpty() || result.scenarios().stream().map(Scenario::name).distinct().count()!=3) throw ApiException.engine();
   return result;
  } catch (RuntimeException e) {throw ApiException.engine();}
 }
}
