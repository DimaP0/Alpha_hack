package ru.alfa.navigator.application;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import ru.alfa.navigator.common.Api.*;
import java.util.List;
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name="bearerAuth")
@RestController @RequestMapping("/api/v1") @Validated
public class NavigatorController {
 private final NavigatorService service;
 public NavigatorController(NavigatorService service) {this.service=service;}
 @GetMapping("/credit-products") public List<CreditProduct> products() {return service.products();}
 @GetMapping("/companies/me") public Company company(@AuthenticationPrincipal UserEntity u) {return service.company(u);}
 @PutMapping("/companies/me/financials") public Company financials(@AuthenticationPrincipal UserEntity u,@RequestBody @Valid FinancialsUpdateRequest p) {return service.updateCompany(u,p);}
 @PostMapping("/simulations") public SimulationResponse simulate(@AuthenticationPrincipal UserEntity u,@RequestBody @Valid LoanParameters p) {return service.simulate(u,p);}
 @GetMapping("/applications") public List<ApplicationView> applications(@AuthenticationPrincipal UserEntity u) {return service.list(u,false,null);}
 @PostMapping("/applications") @ResponseStatus(HttpStatus.CREATED) public ApplicationView create(@AuthenticationPrincipal UserEntity u,@RequestBody @Valid ApplicationInput p) {return service.create(u,p);}
 @GetMapping("/applications/{id}") public ApplicationView application(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id) {return service.find(u,id);}
 @PutMapping("/applications/{id}") public ApplicationView edit(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id,@RequestBody @Valid ApplicationInput p) {return service.edit(u,id,p);}
 @PostMapping("/applications/{id}/submit") public ApplicationView submit(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id) {return service.submit(u,id,false);}
 @PostMapping("/applications/{id}/resubmit") public ApplicationView resubmit(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id) {return service.submit(u,id,true);}
 @PostMapping("/applications/{id}/accept-offer") public ApplicationView accept(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id) {return service.accept(u,id);}
 @GetMapping("/bank/applications") public List<ApplicationView> bankApplications(@AuthenticationPrincipal UserEntity u,@RequestParam(required=false) Status status) {return service.list(u,true,status);}
 @PostMapping("/bank/applications/{id}/decision") public ApplicationView decision(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id,@RequestBody @Valid BankDecisionRequest p) {return service.decide(u,id,p);}
 @PostMapping("/bank/applications/{id}/simulate-disbursement") public ApplicationView disburse(@AuthenticationPrincipal UserEntity u,@PathVariable @Min(1) Long id) {return service.disburse(u,id);}
}
