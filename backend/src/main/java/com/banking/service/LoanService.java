package com.banking.service;

import com.banking.dto.AdminDtos.LoanDecisionRequest;
import com.banking.dto.BankingDtos.*;
import com.banking.exception.ApiException;
import com.banking.model.*;
import com.banking.repository.AccountRepository;
import com.banking.repository.LoanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class LoanService {

    public static final List<LoanProduct> PRODUCTS = List.of(
            new LoanProduct(Loan.LoanType.HOME, "Home loan", new BigDecimal("8.50"), new BigDecimal("10000000"), 360,
                    new BigDecimal("0.35"), "Buy, build or renovate a home. Tenure up to 30 years with no prepayment charges."),
            new LoanProduct(Loan.LoanType.PERSONAL, "Personal loan", new BigDecimal("11.15"), new BigDecimal("2000000"), 72,
                    new BigDecimal("1.50"), "For weddings, travel or medical needs. No collateral, instant disbursal on approval."),
            new LoanProduct(Loan.LoanType.CAR, "Car loan", new BigDecimal("9.15"), new BigDecimal("5000000"), 84,
                    new BigDecimal("0.50"), "Finance up to 90% of the on-road price of a new car."),
            new LoanProduct(Loan.LoanType.EDUCATION, "Education loan", new BigDecimal("8.15"), new BigDecimal("5000000"), 180,
                    new BigDecimal("0.00"), "Study in India or abroad. Interest concession for female students."),
            new LoanProduct(Loan.LoanType.GOLD, "Gold loan", new BigDecimal("8.75"), new BigDecimal("2000000"), 36,
                    new BigDecimal("0.50"), "Quick funds against gold ornaments at competitive rates."));

    private final LoanRepository loanRepository;
    private final AccountRepository accountRepository;
    private final LedgerService ledger;
    private final AuthService authService;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final IdGenerator ids;
    private final DtoMapper mapper;

    public static LoanProduct product(Loan.LoanType type) {
        return PRODUCTS.stream().filter(p -> p.type() == type).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<LoanDto> list(Long userId) {
        return loanRepository.findByUserIdOrderByAppliedAtDesc(userId).stream().map(mapper::loan).toList();
    }

    @Transactional
    public LoanDto apply(Long userId, LoanApplicationRequest request) {
        User user = authService.loadUser(userId);
        LoanProduct product = product(request.type());
        if (request.amount().compareTo(product.maxAmount()) > 0) {
            throw ApiException.badRequest(product.name() + " amount can be at most ₹" + product.maxAmount().toPlainString() + ".");
        }
        if (request.tenureMonths() > product.maxTenureMonths()) {
            throw ApiException.badRequest(product.name() + " tenure can be at most " + product.maxTenureMonths() + " months.");
        }
        Account account = accountRepository.findById(request.disbursementAccountId())
                .filter(a -> a.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Account not found"));
        if (account.getStatus() != Account.AccountStatus.ACTIVE) {
            throw ApiException.badRequest("Choose an active account to receive the loan.");
        }
        boolean hasPending = loanRepository.findByUserIdOrderByAppliedAtDesc(userId).stream()
                .anyMatch(l -> l.getStatus() == Loan.LoanStatus.PENDING && l.getType() == request.type());
        if (hasPending) throw ApiException.conflict("You already have a " + product.name().toLowerCase(Locale.ROOT) + " application under review.");

        BigDecimal amount = LedgerService.normalize(request.amount());
        Loan loan = new Loan();
        loan.setLoanNumber(ids.unique(() -> "LN" + ids.digits(10), loanRepository::existsByLoanNumber));
        loan.setUser(user);
        loan.setType(request.type());
        loan.setPrincipal(amount);
        loan.setInterestRate(product.rate());
        loan.setTenureMonths(request.tenureMonths());
        loan.setEmi(FinanceMath.emi(amount, product.rate(), request.tenureMonths()));
        loan.setPurpose(request.purpose().trim());
        loan.setMonthlyIncome(request.monthlyIncome().setScale(2, RoundingMode.HALF_UP));
        loan.setDisbursementAccount(account);
        loan.setStatus(Loan.LoanStatus.PENDING);
        loanRepository.save(loan);

        notifications.notify(user, Notification.Category.LOAN, "Loan application received",
                product.name() + " application " + loan.getLoanNumber() + " for ₹" + amount.toPlainString()
                        + " is under review. We'll notify you once it's decided.");
        return mapper.loan(loan);
    }

    @Transactional
    public LoanDto repay(Long userId, Long loanId, LoanRepayRequest request) {
        settings.requireNotInMaintenance();
        User user = authService.loadUser(userId);
        authService.requirePin(user, request.pin());
        Loan loan = loanRepository.findByIdAndUserId(loanId, userId).orElseThrow(() -> ApiException.notFound("Loan not found"));
        if (loan.getStatus() != Loan.LoanStatus.ACTIVE) throw ApiException.badRequest("Only active loans can be repaid.");
        Account account = accountRepository.findById(request.accountId())
                .filter(a -> a.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Account not found"));

        // Each payment first covers this month's interest; the rest reduces the principal.
        BigDecimal interest = FinanceMath.monthlyInterest(loan.getOutstanding(), loan.getInterestRate());
        BigDecimal payoff = loan.getOutstanding().add(interest);
        BigDecimal minimum = loan.getEmi().min(payoff);
        BigDecimal amount = LedgerService.normalize(request.amount());
        if (amount.compareTo(minimum) < 0) {
            throw ApiException.badRequest("The minimum payment is one EMI of ₹" + minimum.toPlainString() + ".");
        }
        if (amount.compareTo(payoff) > 0) {
            throw ApiException.badRequest("The full payoff amount is ₹" + payoff.toPlainString() + ". Enter that or less.");
        }

        Account locked = ledger.lockOne(account.getId());
        String reference = ids.reference("LOAN");
        ledger.debit(locked, amount, new LedgerService.Entry(Transaction.Channel.LOAN, reference,
                "Loan " + loan.getLoanNumber(), loan.getLoanNumber(),
                amount.compareTo(payoff) == 0 ? "Loan closure payment" : "Loan EMI / prepayment", true));

        BigDecimal principalPaid = amount.subtract(interest);
        loan.setOutstanding(loan.getOutstanding().subtract(principalPaid).max(BigDecimal.ZERO));
        loan.setEmisPaid(loan.getEmisPaid() + 1);
        if (loan.getOutstanding().signum() == 0) {
            loan.setStatus(Loan.LoanStatus.CLOSED);
            loan.setNextDueDate(null);
            notifications.notify(user, Notification.Category.LOAN, "Loan closed",
                    "Congratulations! Loan " + loan.getLoanNumber() + " is fully repaid. Your no-dues certificate will be emailed to you.");
        } else {
            loan.setNextDueDate((loan.getNextDueDate() != null ? loan.getNextDueDate() : LocalDate.now()).plusMonths(1));
            notifications.notify(user, Notification.Category.LOAN, "Loan payment received",
                    "₹" + amount.toPlainString() + " received for loan " + loan.getLoanNumber() + ". Outstanding principal: ₹"
                            + loan.getOutstanding().toPlainString() + ".");
        }
        return mapper.loan(loan);
    }

    // ---------- Admin ----------

    @Transactional(readOnly = true)
    public List<LoanDto> adminList(Loan.LoanStatus status) {
        List<Loan> loans = status == null ? loanRepository.findAllByOrderByAppliedAtDesc() : loanRepository.findByStatusOrderByAppliedAtDesc(status);
        return loans.stream().map(mapper::loan).toList();
    }

    /** Approving disburses the principal to the customer's account and deducts the processing fee. */
    @Transactional
    public LoanDto decide(Long loanId, LoanDecisionRequest request) {
        Loan loan = loanRepository.findById(loanId).orElseThrow(() -> ApiException.notFound("Loan not found"));
        if (loan.getStatus() != Loan.LoanStatus.PENDING) throw ApiException.badRequest("This application has already been decided.");
        String remarks = request.remarks() == null || request.remarks().isBlank() ? null : request.remarks().trim();
        loan.setDecidedAt(LocalDateTime.now());
        loan.setRemarks(remarks);

        if (!request.approve()) {
            if (remarks == null) throw ApiException.badRequest("Add a reason for rejecting the application.");
            loan.setStatus(Loan.LoanStatus.REJECTED);
            notifications.notify(loan.getUser(), Notification.Category.LOAN, "Loan application declined",
                    "Application " + loan.getLoanNumber() + " was not approved: " + remarks);
            return mapper.loan(loan);
        }

        Account account = ledger.lockOne(loan.getDisbursementAccount().getId());
        LoanProduct product = product(loan.getType());
        ledger.credit(account, loan.getPrincipal(), new LedgerService.Entry(Transaction.Channel.LOAN, loan.getLoanNumber(),
                BankConstants.BANK_NAME, loan.getLoanNumber(), product.name() + " disbursement", true));
        BigDecimal fee = loan.getPrincipal().multiply(product.processingFeePct())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        if (fee.signum() > 0) {
            ledger.debit(account, fee, new LedgerService.Entry(Transaction.Channel.LOAN, loan.getLoanNumber(),
                    BankConstants.BANK_NAME, loan.getLoanNumber(), product.name() + " processing fee", true));
        }
        loan.setStatus(Loan.LoanStatus.ACTIVE);
        loan.setOutstanding(loan.getPrincipal());
        loan.setNextDueDate(LocalDate.now().plusMonths(1));
        notifications.notify(loan.getUser(), Notification.Category.LOAN, "Loan approved and disbursed",
                "₹" + loan.getPrincipal().toPlainString() + " for loan " + loan.getLoanNumber() + " was credited to account ending "
                        + LedgerService.last4(account) + ". First EMI of ₹" + loan.getEmi().toPlainString() + " is due on "
                        + loan.getNextDueDate() + ".");
        return mapper.loan(loan);
    }
}
