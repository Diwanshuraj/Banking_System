package com.banking.service;

import com.banking.dto.BankingDtos.*;
import com.banking.exception.ApiException;
import com.banking.model.*;
import com.banking.repository.AccountRepository;
import com.banking.repository.FixedDepositRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DepositService {

    /** Premature withdrawal pays this much less than the rate for the period actually held. */
    private static final BigDecimal EARLY_CLOSURE_PENALTY = new BigDecimal("0.50");

    public static final List<FdRate> RATES = List.of(
            new FdRate(1, 2, "1 to 2 months", new BigDecimal("3.50"), new BigDecimal("4.00")),
            new FdRate(3, 5, "3 to 5 months", new BigDecimal("5.50"), new BigDecimal("6.00")),
            new FdRate(6, 11, "6 to 11 months", new BigDecimal("6.25"), new BigDecimal("6.75")),
            new FdRate(12, 23, "1 year to < 2 years", new BigDecimal("6.80"), new BigDecimal("7.30")),
            new FdRate(24, 35, "2 years to < 3 years", new BigDecimal("7.00"), new BigDecimal("7.50")),
            new FdRate(36, 59, "3 years to < 5 years", new BigDecimal("6.75"), new BigDecimal("7.25")),
            new FdRate(60, 120, "5 years to 10 years", new BigDecimal("6.50"), new BigDecimal("7.50")));

    private final FixedDepositRepository fdRepository;
    private final AccountRepository accountRepository;
    private final LedgerService ledger;
    private final AuthService authService;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final IdGenerator ids;
    private final DtoMapper mapper;

    public static BigDecimal rateFor(int months, boolean senior) {
        FdRate slab = RATES.stream()
                .filter(r -> months >= r.minMonths() && months <= r.maxMonths())
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("Tenure must be between 1 and 120 months."));
        return senior ? slab.seniorRate() : slab.rate();
    }

    @Transactional(readOnly = true)
    public List<FixedDepositDto> list(Long userId) {
        return fdRepository.findByUserIdOrderByStartDateDesc(userId).stream().map(mapper::fixedDeposit).toList();
    }

    @Transactional
    public FixedDepositDto open(Long userId, OpenFdRequest request) {
        settings.requireNotInMaintenance();
        User user = authService.loadUser(userId);
        authService.requirePin(user, request.pin());
        Account source = accountRepository.findById(request.sourceAccountId())
                .filter(a -> a.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Account not found"));

        BigDecimal amount = LedgerService.normalize(request.amount());
        BigDecimal rate = rateFor(request.tenureMonths(), user.isSeniorCitizen());
        LocalDate start = LocalDate.now();

        FixedDeposit fd = new FixedDeposit();
        fd.setFdNumber(ids.unique(() -> "FD" + ids.digits(10), fdRepository::existsByFdNumber));
        fd.setUser(user);
        fd.setSourceAccount(source);
        fd.setPrincipal(amount);
        fd.setInterestRate(rate);
        fd.setTenureMonths(request.tenureMonths());
        fd.setStartDate(start);
        fd.setMaturityDate(start.plusMonths(request.tenureMonths()));
        fd.setMaturityAmount(FinanceMath.fdMaturity(amount, rate, request.tenureMonths()));
        fd.setAutoRenew(request.autoRenew());
        fd.setStatus(FixedDeposit.FdStatus.ACTIVE);

        Account locked = ledger.lockOne(source.getId());
        ledger.debit(locked, amount, new LedgerService.Entry(Transaction.Channel.FIXED_DEPOSIT, fd.getFdNumber(),
                "Fixed deposit " + fd.getFdNumber(), null, "Fixed deposit opened for " + request.tenureMonths() + " months", true));
        fdRepository.save(fd);

        notifications.notify(user, Notification.Category.ACCOUNT, "Fixed deposit opened",
                "FD " + fd.getFdNumber() + " of ₹" + amount.toPlainString() + " at " + rate.toPlainString()
                        + "% matures on " + fd.getMaturityDate() + " for ₹" + fd.getMaturityAmount().toPlainString() + ".");
        return mapper.fixedDeposit(fd);
    }

    @Transactional
    public FixedDepositDto closeEarly(Long userId, Long fdId, String pin) {
        settings.requireNotInMaintenance();
        User user = authService.loadUser(userId);
        authService.requirePin(user, pin);
        FixedDeposit fd = fdRepository.findByIdAndUserId(fdId, userId)
                .orElseThrow(() -> ApiException.notFound("Fixed deposit not found"));
        if (fd.getStatus() != FixedDeposit.FdStatus.ACTIVE) throw ApiException.badRequest("This deposit is already closed.");

        long daysHeld = ChronoUnit.DAYS.between(fd.getStartDate(), LocalDate.now());
        int monthsHeld = (int) ChronoUnit.MONTHS.between(fd.getStartDate(), LocalDate.now());
        BigDecimal payout;
        if (daysHeld < 7) {
            payout = fd.getPrincipal(); // No interest if withdrawn within 7 days.
        } else {
            BigDecimal heldRate = rateFor(Math.max(1, Math.min(monthsHeld, 120)), user.isSeniorCitizen());
            BigDecimal effective = heldRate.min(fd.getInterestRate()).subtract(EARLY_CLOSURE_PENALTY).max(BigDecimal.ZERO);
            payout = FinanceMath.fdValueAfterDays(fd.getPrincipal(), effective, daysHeld).max(fd.getPrincipal());
        }

        Account locked = ledger.lockOne(fd.getSourceAccount().getId());
        ledger.credit(locked, payout, new LedgerService.Entry(Transaction.Channel.FIXED_DEPOSIT, fd.getFdNumber(),
                "Fixed deposit " + fd.getFdNumber(), null, "Premature closure of fixed deposit", true));
        fd.setStatus(FixedDeposit.FdStatus.CLOSED);
        fd.setClosedAt(LocalDateTime.now());
        fd.setPayoutAmount(payout);

        notifications.notify(user, Notification.Category.ACCOUNT, "Fixed deposit closed",
                "FD " + fd.getFdNumber() + " was closed early. ₹" + payout.toPlainString() + " was credited to account ending "
                        + LedgerService.last4(locked) + ".");
        return mapper.fixedDeposit(fd);
    }

    /** Pays out or renews deposits that have matured. Runs daily at 00:15 and once at startup. */
    @Scheduled(cron = "0 15 0 * * *")
    @Transactional
    public void processMaturities() {
        List<FixedDeposit> due = fdRepository.findByStatusAndMaturityDateLessThanEqual(FixedDeposit.FdStatus.ACTIVE, LocalDate.now());
        for (FixedDeposit fd : due) {
            if (fd.isAutoRenew()) {
                BigDecimal principal = fd.getMaturityAmount();
                BigDecimal rate = rateFor(fd.getTenureMonths(), fd.getUser().isSeniorCitizen());
                fd.setPrincipal(principal);
                fd.setInterestRate(rate);
                fd.setStartDate(fd.getMaturityDate());
                fd.setMaturityDate(fd.getMaturityDate().plusMonths(fd.getTenureMonths()));
                fd.setMaturityAmount(FinanceMath.fdMaturity(principal, rate, fd.getTenureMonths()));
                notifications.notify(fd.getUser(), Notification.Category.ACCOUNT, "Fixed deposit renewed",
                        "FD " + fd.getFdNumber() + " was renewed for ₹" + principal.toPlainString() + " at " + rate.toPlainString() + "%.");
            } else {
                Account locked = ledger.lockOne(fd.getSourceAccount().getId());
                ledger.credit(locked, fd.getMaturityAmount(), new LedgerService.Entry(Transaction.Channel.FIXED_DEPOSIT,
                        fd.getFdNumber(), "Fixed deposit " + fd.getFdNumber(), null, "Fixed deposit maturity proceeds", true));
                fd.setStatus(FixedDeposit.FdStatus.MATURED);
                fd.setClosedAt(LocalDateTime.now());
                fd.setPayoutAmount(fd.getMaturityAmount());
                notifications.notify(fd.getUser(), Notification.Category.ACCOUNT, "Fixed deposit matured",
                        "₹" + fd.getMaturityAmount().toPlainString() + " from FD " + fd.getFdNumber() + " was credited to account ending "
                                + LedgerService.last4(locked) + ".");
            }
        }
        if (!due.isEmpty()) log.info("Processed {} matured fixed deposits", due.size());
    }
}
