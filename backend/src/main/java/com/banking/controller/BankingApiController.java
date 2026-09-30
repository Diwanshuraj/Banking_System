package com.banking.controller;

import com.banking.dto.AuthDtos.ChangePasswordRequest;
import com.banking.dto.AuthDtos.ProfileUpdateRequest;
import com.banking.dto.AuthDtos.SetPinRequest;
import com.banking.dto.AuthDtos.UserDto;
import com.banking.dto.BankingDtos.*;
import com.banking.model.DebitCard;
import com.banking.model.Transaction;
import com.banking.security.AuthUser;
import com.banking.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/** Customer internet-banking API. Every call is scoped to the signed-in customer's own data. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BankingApiController {

    private final AccountService accountService;
    private final TransferService transferService;
    private final DepositService depositService;
    private final LoanService loanService;
    private final ServicingService servicingService;
    private final NotificationService notificationService;
    private final AuthService authService;

    // ---------- Dashboard & accounts ----------

    @GetMapping("/dashboard")
    public DashboardDto dashboard(@AuthenticationPrincipal AuthUser user) {
        return accountService.dashboard(user.id());
    }

    @GetMapping("/accounts")
    public List<AccountDto> accounts(@AuthenticationPrincipal AuthUser user) {
        return accountService.list(user.id());
    }

    @GetMapping("/accounts/{id}")
    public AccountDto account(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return accountService.get(user.id(), id);
    }

    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountDto openAccount(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody OpenAccountRequest request) {
        return accountService.open(user.id(), request);
    }

    @GetMapping("/accounts/{id}/statement.csv")
    public ResponseEntity<byte[]> statement(@AuthenticationPrincipal AuthUser user, @PathVariable Long id,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        String csv = accountService.statementCsv(user.id(), id, from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"statement-" + from + "-to-" + to + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(("﻿" + csv).getBytes(StandardCharsets.UTF_8)); // BOM so Excel shows ₹ correctly.
    }

    @GetMapping("/transactions")
    public PageResponse<TransactionDto> transactions(@AuthenticationPrincipal AuthUser user,
                                                     @RequestParam(required = false) Long accountId,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                     @RequestParam(required = false) Transaction.Direction direction,
                                                     @RequestParam(required = false) Transaction.Channel channel,
                                                     @RequestParam(required = false) String q,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return accountService.search(user.id(), new TransactionFilter(accountId, from, to, direction, channel, q), page, size);
    }

    // ---------- Payees & transfers ----------

    @GetMapping("/beneficiaries")
    public List<BeneficiaryDto> beneficiaries(@AuthenticationPrincipal AuthUser user) {
        return transferService.payees(user.id());
    }

    @PostMapping("/beneficiaries")
    @ResponseStatus(HttpStatus.CREATED)
    public BeneficiaryDto addBeneficiary(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody BeneficiaryRequest request) {
        return transferService.addPayee(user.id(), request);
    }

    @DeleteMapping("/beneficiaries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeBeneficiary(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        transferService.removePayee(user.id(), id);
    }

    @PostMapping("/transfers")
    public TransferReceipt transfer(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody TransferRequest request) {
        return transferService.transfer(user.id(), request);
    }

    @GetMapping("/transfers/limits")
    public TransferLimits limits(@AuthenticationPrincipal AuthUser user) {
        return transferService.limits(user.id());
    }

    @GetMapping("/transfers/upi/lookup")
    public UpiLookup lookupUpi(@RequestParam String upiId) {
        return transferService.lookupUpi(upiId);
    }

    // ---------- Deposits & loans ----------

    @GetMapping("/fixed-deposits")
    public List<FixedDepositDto> deposits(@AuthenticationPrincipal AuthUser user) {
        return depositService.list(user.id());
    }

    @GetMapping("/fixed-deposits/rates")
    public List<FdRate> depositRates() {
        return DepositService.RATES;
    }

    @PostMapping("/fixed-deposits")
    @ResponseStatus(HttpStatus.CREATED)
    public FixedDepositDto openDeposit(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody OpenFdRequest request) {
        return depositService.open(user.id(), request);
    }

    @PostMapping("/fixed-deposits/{id}/close")
    public FixedDepositDto closeDeposit(@AuthenticationPrincipal AuthUser user, @PathVariable Long id, @Valid @RequestBody PinRequest request) {
        return depositService.closeEarly(user.id(), id, request.pin());
    }

    @GetMapping("/loans")
    public List<LoanDto> loans(@AuthenticationPrincipal AuthUser user) {
        return loanService.list(user.id());
    }

    @GetMapping("/loans/products")
    public List<LoanProduct> loanProducts() {
        return LoanService.PRODUCTS;
    }

    @PostMapping("/loans")
    @ResponseStatus(HttpStatus.CREATED)
    public LoanDto applyForLoan(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody LoanApplicationRequest request) {
        return loanService.apply(user.id(), request);
    }

    @PostMapping("/loans/{id}/repay")
    public LoanDto repayLoan(@AuthenticationPrincipal AuthUser user, @PathVariable Long id, @Valid @RequestBody LoanRepayRequest request) {
        return loanService.repay(user.id(), id, request);
    }

    // ---------- Cards, bills, service requests ----------

    @GetMapping("/cards")
    public List<CardDto> cards(@AuthenticationPrincipal AuthUser user) {
        return servicingService.cards(user.id());
    }

    @PutMapping("/cards/{id}/controls")
    public CardDto updateCard(@AuthenticationPrincipal AuthUser user, @PathVariable Long id, @Valid @RequestBody CardControlsRequest request) {
        return servicingService.updateControls(user.id(), id, request);
    }

    @PostMapping("/cards/{id}/block")
    public CardDto blockCard(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return servicingService.setCardStatus(user.id(), id, DebitCard.CardStatus.BLOCKED);
    }

    @PostMapping("/cards/{id}/unblock")
    public CardDto unblockCard(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return servicingService.setCardStatus(user.id(), id, DebitCard.CardStatus.ACTIVE);
    }

    @PostMapping("/cards/{id}/hotlist")
    public CardDto hotlistCard(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return servicingService.setCardStatus(user.id(), id, DebitCard.CardStatus.HOTLISTED);
    }

    @GetMapping("/bills/billers")
    public List<BillerCategory> billers() {
        return ServicingService.BILLERS;
    }

    @PostMapping("/bills/pay")
    public BillPaymentDto payBill(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody BillPaymentRequest request) {
        return servicingService.payBill(user.id(), request);
    }

    @GetMapping("/bills/history")
    public List<BillPaymentDto> billHistory(@AuthenticationPrincipal AuthUser user) {
        return servicingService.billHistory(user.id());
    }

    @GetMapping("/service-requests")
    public List<ServiceRequestDto> serviceRequests(@AuthenticationPrincipal AuthUser user) {
        return servicingService.requests(user.id());
    }

    @PostMapping("/service-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceRequestDto createServiceRequest(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ServiceRequestCreate request) {
        return servicingService.createRequest(user.id(), request);
    }

    // ---------- Notifications & profile ----------

    @GetMapping("/notifications")
    public List<NotificationDto> notifications(@AuthenticationPrincipal AuthUser user) {
        return notificationService.list(user.id());
    }

    @PostMapping("/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        notificationService.markRead(user.id(), id);
    }

    @PostMapping("/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(@AuthenticationPrincipal AuthUser user) {
        notificationService.markAllRead(user.id());
    }

    @PutMapping("/profile")
    public UserDto updateProfile(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ProfileUpdateRequest request) {
        return authService.updateProfile(user.id(), request);
    }

    @PostMapping("/profile/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(user.id(), request);
    }

    @PostMapping("/profile/pin")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setPin(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody SetPinRequest request) {
        authService.setPin(user.id(), request);
    }
}
