package com.banking.service;

import com.banking.dto.AdminDtos.*;
import com.banking.dto.AuthDtos.UserDto;
import com.banking.dto.BankingDtos.AccountDto;
import com.banking.dto.BankingDtos.TransactionDto;
import com.banking.exception.ApiException;
import com.banking.model.*;
import com.banking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/** Branch-admin operations: bank-wide metrics, customer and account management, branch cash and interest credit. */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final LoanRepository loanRepository;
    private final ServiceRequestRepository requestRepository;
    private final OnboardingService onboarding;
    private final LedgerService ledger;
    private final NotificationService notifications;
    private final IdGenerator ids;
    private final DtoMapper mapper;

    /** Bank-wide KPIs, channel breakdown and daily volume for the admin overview. */
    @Transactional(readOnly = true)
    public AdminMetrics metrics() {
        LocalDate today = LocalDate.now();
        // Volume = money leaving accounts (the debit leg), so an internal transfer is counted once.
        List<Transaction> recentDebits = transactionRepository.findByDirectionAndCreatedAtGreaterThanEqual(
                Transaction.Direction.DEBIT, today.minusDays(29).atStartOfDay());

        Map<LocalDate, BigDecimal[]> daily = new LinkedHashMap<>();
        for (int i = 13; i >= 0; i--) daily.put(today.minusDays(i), new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        Map<Transaction.Channel, BigDecimal[]> channels = new EnumMap<>(Transaction.Channel.class);
        for (Transaction txn : recentDebits) {
            BigDecimal[] day = daily.get(txn.getCreatedAt().toLocalDate());
            if (day != null) {
                day[0] = day[0].add(txn.getAmount());
                day[1] = day[1].add(BigDecimal.ONE);
            }
            BigDecimal[] channel = channels.computeIfAbsent(txn.getChannel(), c -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            channel[0] = channel[0].add(BigDecimal.ONE);
            channel[1] = channel[1].add(txn.getAmount());
        }
        BigDecimal[] todayStats = daily.get(today);

        return new AdminMetrics(
                userRepository.countByRole(User.Role.ROLE_CUSTOMER),
                accountRepository.countByStatus(Account.AccountStatus.ACTIVE),
                accountRepository.countByStatus(Account.AccountStatus.FROZEN),
                accountRepository.totalBalanceExcluding(Account.AccountStatus.CLOSED),
                todayStats[0],
                todayStats[1].longValue(),
                loanRepository.countByStatus(Loan.LoanStatus.PENDING),
                requestRepository.countByStatusIn(List.of(ServiceRequest.RequestStatus.OPEN, ServiceRequest.RequestStatus.IN_PROGRESS)),
                loanRepository.sumOutstanding(Loan.LoanStatus.ACTIVE),
                channels.entrySet().stream()
                        .sorted((a, b) -> b.getValue()[1].compareTo(a.getValue()[1]))
                        .map(e -> new ChannelStat(e.getKey(), e.getValue()[0].longValue(), e.getValue()[1]))
                        .toList(),
                daily.entrySet().stream()
                        .map(e -> new DailyVolume(e.getKey(), e.getValue()[0], e.getValue()[1].longValue()))
                        .toList());
    }

    // ---------- Customers ----------

    /** Users matching the search text, or all users (newest first) when it is blank. */
    @Transactional(readOnly = true)
    public List<UserDto> users(String q) {
        List<User> users = q == null || q.isBlank() ? userRepository.findAllByOrderByCreatedAtDesc() : userRepository.search(q.trim());
        return users.stream().map(mapper::user).toList();
    }

    /** One user together with their accounts. */
    @Transactional(readOnly = true)
    public AdminUserDetail user(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found"));
        return detail(user);
    }

    private AdminUserDetail detail(User user) {
        List<AccountDto> accounts = accountRepository.findByUserIdOrderByOpenedAtAsc(user.getId()).stream().map(mapper::account).toList();
        return new AdminUserDetail(mapper.user(user), accounts);
    }

    /** Onboards a customer at the branch, opens their first account and credits any opening cash deposit. */
    @Transactional
    public AdminUserDetail createCustomer(AdminCreateCustomerRequest request) {
        User user = onboarding.createCustomer(new OnboardingService.NewCustomer(
                request.fullName(), request.email(), request.phone(), request.password(), request.panNumber(),
                request.aadhaarNumber(), request.dateOfBirth(), request.address()));
        Account account = onboarding.openAccount(user, request.accountType(), null);
        if (request.openingDeposit().signum() > 0) {
            ledger.credit(account, request.openingDeposit(), new LedgerService.Entry(Transaction.Channel.CASH,
                    ids.reference("CSH"), "Branch cash deposit", null, "Opening deposit", false));
        }
        return detail(user);
    }

    /** Suspends, reactivates or unlocks a user. */
    @Transactional
    public UserDto setUserStatus(Long adminId, Long userId, User.UserStatus status) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("Customer not found"));
        if (user.getId().equals(adminId)) throw ApiException.badRequest("You can't change your own access.");
        if (user.getStatus() == status) return mapper.user(user);
        User.UserStatus previous = user.getStatus();
        user.setStatus(status);
        if (status == User.UserStatus.ACTIVE) {
            user.setFailedLoginAttempts(0);
            notifications.notify(user, Notification.Category.SECURITY,
                    previous == User.UserStatus.LOCKED ? "Internet banking unlocked" : "Internet banking reactivated",
                    "Your internet banking access has been restored by the branch.");
        }
        return mapper.user(user);
    }

    // ---------- Accounts ----------

    /** Accounts matching the search text, with their owners. */
    @Transactional(readOnly = true)
    public List<AccountDto> accounts(String q) {
        List<Account> accounts = q == null || q.isBlank() ? accountRepository.findAllWithUser() : accountRepository.searchWithUser(q.trim());
        return accounts.stream().map(mapper::account).toList();
    }

    /** Freezes or unfreezes an account. */
    @Transactional
    public AccountDto setAccountStatus(Long accountId, Account.AccountStatus status) {
        if (status == Account.AccountStatus.CLOSED) throw ApiException.badRequest("Close accounts through a closure service request.");
        Account account = ledger.lockOne(accountId);
        if (account.getStatus() == Account.AccountStatus.CLOSED) throw ApiException.badRequest("This account is closed.");
        if (account.getStatus() == status) return mapper.account(account);
        account.setStatus(status);
        notifications.notify(account.getUser(), Notification.Category.ACCOUNT,
                status == Account.AccountStatus.FROZEN ? "Account frozen" : "Account unfrozen",
                status == Account.AccountStatus.FROZEN
                        ? "Debits from account ending " + LedgerService.last4(account) + " are blocked. Please contact your branch."
                        : "Account ending " + LedgerService.last4(account) + " can send money again.");
        return mapper.account(account);
    }

    /** Posts a branch cash deposit or withdrawal. */
    @Transactional
    public TransactionDto cash(Long accountId, CashRequest request) {
        Account account = ledger.lockOne(accountId);
        String reference = ids.reference("CSH");
        String remarks = request.remarks() == null || request.remarks().isBlank() ? null : request.remarks().trim();
        Transaction txn;
        if (request.type() == CashType.DEPOSIT) {
            txn = ledger.credit(account, request.amount(), new LedgerService.Entry(Transaction.Channel.CASH, reference,
                    "Branch cash deposit", null, remarks != null ? remarks : "Cash deposit at branch", false));
        } else {
            txn = ledger.debit(account, request.amount(), new LedgerService.Entry(Transaction.Channel.CASH, reference,
                    "Branch cash withdrawal", null, remarks != null ? remarks : "Cash withdrawal at branch", false));
        }
        notifications.notify(account.getUser(), Notification.Category.TRANSACTION,
                request.type() == CashType.DEPOSIT ? "Cash deposited" : "Cash withdrawn",
                "₹" + txn.getAmount().toPlainString() + (request.type() == CashType.DEPOSIT ? " deposited to" : " withdrawn from")
                        + " account ending " + LedgerService.last4(account) + " at the branch. Balance: ₹" + account.getBalance().toPlainString() + ".");
        return mapper.transaction(txn);
    }

    /** Credits one month of interest to every active savings and salary account. */
    @Transactional
    public InterestResult creditInterest() {
        String period = YearMonth.now().toString();
        int count = 0;
        BigDecimal total = BigDecimal.ZERO;
        for (Account candidate : accountRepository.findByAccountTypeInAndStatus(
                List.of(Account.AccountType.SAVINGS, Account.AccountType.SALARY), Account.AccountStatus.ACTIVE)) {
            String reference = "INT" + period.replace("-", "") + candidate.getId();
            if (transactionRepository.existsByReferenceId(reference)) continue; // Already credited this month.
            Account account = ledger.lockOne(candidate.getId());
            BigDecimal interest = account.getBalance().multiply(account.getInterestRate())
                    .divide(BigDecimal.valueOf(1200), 2, RoundingMode.HALF_UP);
            if (interest.signum() <= 0) continue;
            ledger.credit(account, interest, new LedgerService.Entry(Transaction.Channel.INTEREST, reference,
                    BankConstants.BANK_NAME, null, "Savings interest for " + period, false));
            count++;
            total = total.add(interest);
        }
        return new InterestResult(count, total);
    }
}
