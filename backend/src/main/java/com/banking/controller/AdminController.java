package com.banking.controller;

import com.banking.dto.AdminDtos.*;
import com.banking.dto.AuthDtos.UserDto;
import com.banking.dto.BankingDtos.*;
import com.banking.model.Loan;
import com.banking.model.ServiceRequest;
import com.banking.model.Transaction;
import com.banking.security.AuthUser;
import com.banking.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Branch administration API. Restricted to ROLE_ADMIN in SecurityConfig. */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final AccountService accountService;
    private final LoanService loanService;
    private final ServicingService servicingService;
    private final SettingsService settingsService;
    private final DtoMapper mapper;

    @GetMapping("/metrics")
    public AdminMetrics metrics() {
        return adminService.metrics();
    }

    @GetMapping("/users")
    public List<UserDto> users(@RequestParam(required = false) String q) {
        return adminService.users(q);
    }

    @GetMapping("/users/{id}")
    public AdminUserDetail user(@PathVariable Long id) {
        return adminService.user(id);
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserDetail createCustomer(@Valid @RequestBody AdminCreateCustomerRequest request) {
        return adminService.createCustomer(request);
    }

    @PatchMapping("/users/{id}/status")
    public UserDto setUserStatus(@AuthenticationPrincipal AuthUser admin, @PathVariable Long id, @Valid @RequestBody UserStatusRequest request) {
        return adminService.setUserStatus(admin.id(), id, request.status());
    }

    @GetMapping("/accounts")
    public List<AccountDto> accounts(@RequestParam(required = false) String q) {
        return adminService.accounts(q);
    }

    @PatchMapping("/accounts/{id}/status")
    public AccountDto setAccountStatus(@PathVariable Long id, @Valid @RequestBody AccountStatusRequest request) {
        return adminService.setAccountStatus(id, request.status());
    }

    @PostMapping("/accounts/{id}/cash")
    public TransactionDto cash(@PathVariable Long id, @Valid @RequestBody CashRequest request) {
        return adminService.cash(id, request);
    }

    @GetMapping("/transactions")
    public PageResponse<TransactionDto> transactions(@RequestParam(required = false) Long accountId,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                     @RequestParam(required = false) Transaction.Direction direction,
                                                     @RequestParam(required = false) Transaction.Channel channel,
                                                     @RequestParam(required = false) String q,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "25") int size) {
        return accountService.searchAll(null, new TransactionFilter(accountId, from, to, direction, channel, q), page, size);
    }

    @GetMapping("/loans")
    public List<LoanDto> loans(@RequestParam(required = false) Loan.LoanStatus status) {
        return loanService.adminList(status);
    }

    @PostMapping("/loans/{id}/decision")
    public LoanDto decideLoan(@PathVariable Long id, @Valid @RequestBody LoanDecisionRequest request) {
        return loanService.decide(id, request);
    }

    @GetMapping("/service-requests")
    public List<ServiceRequestDto> serviceRequests(@RequestParam(required = false) ServiceRequest.RequestStatus status) {
        return servicingService.adminRequests(status);
    }

    @PatchMapping("/service-requests/{id}")
    public ServiceRequestDto updateServiceRequest(@PathVariable Long id, @Valid @RequestBody ServiceRequestUpdate request) {
        return servicingService.updateRequest(id, request);
    }

    @GetMapping("/settings")
    public List<SettingDto> settings() {
        return settingsService.all().stream().map(mapper::setting).toList();
    }

    @PutMapping("/settings/{key}")
    public SettingDto updateSetting(@PathVariable String key, @Valid @RequestBody SettingUpdate request) {
        return mapper.setting(settingsService.update(key, request.value()));
    }

    @PostMapping("/interest/credit")
    public InterestResult creditInterest() {
        return adminService.creditInterest();
    }
}
