package ru.alfa.navigator;
import org.junit.jupiter.api.Test;
import ru.alfa.navigator.common.Api.*;
import ru.alfa.navigator.common.ApiException;
import ru.alfa.navigator.application.NavigatorService;
import jakarta.validation.Validation;
import java.time.YearMonth;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class ValidationTest {
 private List<MonthlyFinancial> months() {return java.util.stream.IntStream.range(0,12).mapToObj(i->new MonthlyFinancial(YearMonth.of(2025,10).plusMonths(i).toString(),1L,0L)).toList();}
 @Test void acceptsUnsortedButConsecutive() {var rows=new ArrayList<>(months());Collections.reverse(rows);assertEquals("2025-10",NavigatorService.validatedMonths(rows).getFirst().month());}
 @Test void rejectsDuplicateMonth() {var rows=new ArrayList<>(months());rows.set(1,rows.getFirst());assertThrows(ApiException.class,()->NavigatorService.validatedMonths(rows));}
 @Test void rejectsGaps() {var rows=new ArrayList<>(months());rows.set(11,new MonthlyFinancial("2027-10",1L,0L));assertThrows(ApiException.class,()->NavigatorService.validatedMonths(rows));}
 @Test void rejectsWrongCount() {assertThrows(ApiException.class,()->NavigatorService.validatedMonths(months().subList(0,11)));}
 @Test void inputBoundaryValidation() {try(var factory=Validation.buildDefaultValidatorFactory()){var v=factory.getValidator();assertFalse(v.validate(new LoanParameters(1L,1L,12,0L,13)).isEmpty());assertFalse(v.validate(new LoanParameters(1L,1L,12,-1L,1)).isEmpty());assertFalse(v.validate(new LoanParameters(null,1L,12,0L,1)).isEmpty());assertTrue(v.validate(new LoanParameters(1L,1L,12,0L,12)).isEmpty());}}
}
