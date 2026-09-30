package com.banking.service;

import com.banking.dto.BankingDtos.*;
import com.banking.exception.ApiException;
import com.banking.model.*;
import com.banking.repository.*;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final FixedDepositRepository fdRepository;
    private final LoanRepository loanRepository;
    private final NotificationRepository notificationRepository;
    private final OnboardingService onboarding;
    private final AuthService authService;
    private final TransferService transferService;
    private final DtoMapper mapper;

    /** Loads an account and checks it belongs to the user; other customers' accounts look like "not found". */
    public Account ownedAccount(Long userId, Long accountId) {
        Account account = accountRepository.findById(accountId).orElseThrow(() -> ApiException.notFound("Account not found"));
        if (!account.getUser().getId().equals(userId)) throw ApiException.notFound("Account not found");
        return account;
    }

    @Transactional(readOnly = true)
    public List<AccountDto> list(Long userId) {
        return accountRepository.findByUserIdOrderByOpenedAtAsc(userId).stream().map(mapper::account).toList();
    }

    @Transactional(readOnly = true)
    public AccountDto get(Long userId, Long accountId) {
        return mapper.account(ownedAccount(userId, accountId));
    }

    @Transactional
    public AccountDto open(Long userId, OpenAccountRequest request) {
        User user = authService.loadUser(userId);
        long openAccounts = accountRepository.findByUserIdOrderByOpenedAtAsc(userId).stream()
                .filter(a -> a.getStatus() != Account.AccountStatus.CLOSED).count();
        if (openAccounts >= 5) throw ApiException.badRequest("You can hold at most 5 accounts online. Visit a branch to open more.");
        return mapper.account(onboarding.openAccount(user, request.accountType(), request.nomineeName()));
    }

    // ---------- Transactions ----------

    @Transactional(readOnly = true)
    public PageResponse<TransactionDto> search(Long userId, TransactionFilter filter, int page, int size) {
        Collection<Long> accountIds;
        if (filter.accountId() != null) {
            accountIds = List.of(ownedAccount(userId, filter.accountId()).getId());
        } else {
            accountIds = accountRepository.findByUserIdOrderByOpenedAtAsc(userId).stream().map(Account::getId).toList();
            if (accountIds.isEmpty()) return new PageResponse<>(List.of(), page, size, 0, 0);
        }
        return searchAll(accountIds, filter, page, size);
    }

    /** Bank-wide search when {@code accountIds} is null (admin). */
    @Transactional(readOnly = true)
    public PageResponse<TransactionDto> searchAll(Collection<Long> accountIds, TransactionFilter filter, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        Page<Transaction> result = transactionRepository.findAll(spec(accountIds, filter),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new PageResponse<>(result.getContent().stream().map(mapper::transaction).toList(),
                safePage, safeSize, result.getTotalElements(), result.getTotalPages());
    }

    private static Specification<Transaction> spec(Collection<Long> accountIds, TransactionFilter filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<Transaction, Account> account = root.join("account");
            if (accountIds != null) predicates.add(account.get("id").in(accountIds));
            if (filter.accountId() != null) predicates.add(cb.equal(account.get("id"), filter.accountId()));
            if (filter.from() != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filter.from().atStartOfDay()));
            if (filter.to() != null) predicates.add(cb.lessThan(root.get("createdAt"), filter.to().plusDays(1).atStartOfDay()));
            if (filter.direction() != null) predicates.add(cb.equal(root.get("direction"), filter.direction()));
            if (filter.channel() != null) predicates.add(cb.equal(root.get("channel"), filter.channel()));
            if (filter.q() != null && !filter.q().isBlank()) {
                String like = "%" + filter.q().trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("referenceId")), like),
                        cb.like(cb.lower(root.get("description")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("counterpartyName"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("counterpartyAccount"), "")), like),
                        cb.like(account.get("accountNumber"), like)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    @Transactional(readOnly = true)
    public String statementCsv(Long userId, Long accountId, LocalDate from, LocalDate to) {
        Account account = ownedAccount(userId, accountId);
        if (from.isAfter(to)) throw ApiException.badRequest("The start date must be before the end date.");
        if (from.plusYears(1).isBefore(to)) throw ApiException.badRequest("Statements can cover at most one year.");

        DateTimeFormatter date = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm");
        StringBuilder csv = new StringBuilder();
        csv.append(BankConstants.BANK_NAME).append(" - Account statement\n");
        csv.append("Account holder,").append(csvCell(account.getUser().getFullName())).append('\n');
        csv.append("Account number,").append(account.getAccountNumber()).append('\n');
        csv.append("IFSC,").append(account.getIfscCode()).append('\n');
        csv.append("Period,").append(from).append(" to ").append(to).append("\n\n");
        csv.append("Date,Reference,Description,Mode,Debit,Credit,Balance\n");
        for (Transaction txn : transactionRepository.findByAccountIdAndCreatedAtBetweenOrderByCreatedAtAscIdAsc(
                accountId, from.atStartOfDay(), to.plusDays(1).atStartOfDay().minusNanos(1))) {
            boolean debit = txn.getDirection() == Transaction.Direction.DEBIT;
            csv.append(txn.getCreatedAt().format(date)).append(',')
                    .append(csvCell(txn.getReferenceId())).append(',')
                    .append(csvCell(txn.getCounterpartyName() != null ? txn.getCounterpartyName() + " - " + txn.getDescription() : txn.getDescription())).append(',')
                    .append(txn.getChannel()).append(',')
                    .append(debit ? txn.getAmount().toPlainString() : "").append(',')
                    .append(debit ? "" : txn.getAmount().toPlainString()).append(',')
                    .append(txn.getBalanceAfter().toPlainString()).append('\n');
        }
        return csv.toString();
    }

    /** Quotes a CSV cell and neutralises spreadsheet formulas. */
    private static String csvCell(String value) {
        String text = value == null ? "" : value;
        if (!text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    // ---------- Dashboard ----------

    @Transactional(readOnly = true)
    public DashboardDto dashboard(Long userId) {
        List<Account> accounts = accountRepository.findByUserIdOrderByOpenedAtAsc(userId);
        List<Long> ids = accounts.stream().map(Account::getId).toList();

        BigDecimal total = accounts.stream()
                .filter(a -> a.getStatus() != Account.AccountStatus.CLOSED)
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<TransactionDto> recent = ids.isEmpty() ? List.of()
                : transactionRepository.findTop5ByAccountIdInOrderByCreatedAtDescIdDesc(ids).stream().map(mapper::transaction).toList();

        YearMonth current = YearMonth.now();
        LocalDateTime since = current.minusMonths(5).atDay(1).atStartOfDay();
        Map<YearMonth, BigDecimal[]> flows = new LinkedHashMap<>();
        for (int i = 5; i >= 0; i--) flows.put(current.minusMonths(i), new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
        if (!ids.isEmpty()) {
            for (Transaction txn : transactionRepository.findByAccountIdInAndCreatedAtGreaterThanEqual(ids, since)) {
                if (txn.isSelfTransfer()) continue;
                BigDecimal[] bucket = flows.get(YearMonth.from(txn.getCreatedAt()));
                if (bucket == null) continue;
                int index = txn.getDirection() == Transaction.Direction.CREDIT ? 0 : 1;
                bucket[index] = bucket[index].add(txn.getAmount());
            }
        }
        DateTimeFormatter label = DateTimeFormatter.ofPattern("MMM yy", Locale.ENGLISH);
        List<MonthlyFlow> monthly = flows.entrySet().stream()
                .map(e -> new MonthlyFlow(e.getKey().format(label), e.getValue()[0], e.getValue()[1]))
                .toList();

        List<FixedDeposit> activeFds = fdRepository.findByUserIdOrderByStartDateDesc(userId).stream()
                .filter(fd -> fd.getStatus() == FixedDeposit.FdStatus.ACTIVE).toList();
        List<Loan> activeLoans = loanRepository.findByUserIdOrderByAppliedAtDesc(userId).stream()
                .filter(l -> l.getStatus() == Loan.LoanStatus.ACTIVE).toList();

        return new DashboardDto(
                accounts.stream().map(mapper::account).toList(),
                total,
                recent,
                monthly,
                activeFds.size(),
                activeFds.stream().map(FixedDeposit::getPrincipal).reduce(BigDecimal.ZERO, BigDecimal::add),
                activeLoans.size(),
                activeLoans.stream().map(Loan::getOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add),
                notificationRepository.countByUserIdAndReadFalse(userId),
                transferService.limits(userId));
    }
}
