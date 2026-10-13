package com.banking.service;

import com.banking.core.BankAccount;
import com.banking.core.Rankings;
import com.banking.exception.BankingException;
import com.banking.jdbc.AccountDao;
import com.banking.jdbc.TransactionDao;
import com.banking.jdbc.TransactionRecord;
import com.banking.model.Transaction;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Builds a customer's 30-day portfolio report. Each account is summarised on its own worker thread
 * (each with its own JDBC connection), then the results are merged on the calling thread.
 */
@Service
public class PortfolioReportService {

    public static final int REPORT_DAYS = 30;
    private static final int RECENT_PER_ACCOUNT = 50;

    private final AccountDao accountDao;
    private final TransactionDao transactionDao;
    private final ExecutorService pool;

    public PortfolioReportService(AccountDao accountDao, TransactionDao transactionDao) {
        this.accountDao = accountDao;
        this.transactionDao = transactionDao;
        AtomicInteger threadNumber = new AtomicInteger();
        this.pool = Executors.newFixedThreadPool(4, task -> {
            Thread thread = new Thread(task, "report-worker-" + threadNumber.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    public record AccountSummary(BankAccount account, BigDecimal moneyIn, BigDecimal moneyOut,
                                 Map<Transaction.Channel, BigDecimal> spendByChannel, List<TransactionRecord> recent) {
    }

    public record Report(List<AccountSummary> accounts, BigDecimal totalBalance, BigDecimal totalMonthlyInterest,
                         Map<Transaction.Channel, BigDecimal> spendByChannel, List<TransactionRecord> largestTransactions,
                         Set<String> workerThreads, long elapsedMillis) {
    }

    public Report build(long userId) throws BankingException {
        long started = System.nanoTime();
        List<BankAccount> accounts = accountDao.findByUserId(userId);
        LocalDateTime from = LocalDate.now().minusDays(REPORT_DAYS).atStartOfDay();
        Set<String> workerThreads = ConcurrentHashMap.newKeySet();

        List<Callable<AccountSummary>> tasks = new ArrayList<>();
        for (BankAccount account : accounts) {
            tasks.add(() -> {
                workerThreads.add(Thread.currentThread().getName());
                return summarise(account, from);
            });
        }

        List<AccountSummary> summaries = new ArrayList<>();
        try {
            for (Future<AccountSummary> future : pool.invokeAll(tasks, 15, TimeUnit.SECONDS)) {
                summaries.add(future.get());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BankingException("The report was interrupted.", e);
        } catch (CancellationException e) {
            throw new BankingException("The report took too long. Please try again.", e);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof BankingException cause) throw cause;
            throw new BankingException("The report could not be built.", e.getCause());
        }

        summaries.sort(Comparator.comparing((AccountSummary s) -> s.account().getBalance()).reversed());

        Map<Transaction.Channel, BigDecimal> merged = new EnumMap<>(Transaction.Channel.class);
        List<TransactionRecord> allRecent = new ArrayList<>();
        BigDecimal totalBalance = BigDecimal.ZERO;
        BigDecimal totalInterest = BigDecimal.ZERO;
        for (AccountSummary summary : summaries) {
            summary.spendByChannel().forEach((channel, amount) -> merged.merge(channel, amount, BigDecimal::add));
            allRecent.addAll(summary.recent());
            totalBalance = totalBalance.add(summary.account().getBalance());
            totalInterest = totalInterest.add(summary.account().monthlyInterest()); // polymorphic call
        }

        return new Report(Collections.unmodifiableList(summaries), totalBalance, totalInterest,
                sortedByValueDesc(merged),
                Rankings.topN(allRecent, 5, Comparator.comparing(TransactionRecord::amount)),
                new TreeSet<>(workerThreads),
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
    }

    private AccountSummary summarise(BankAccount account, LocalDateTime from) throws BankingException {
        Map<Transaction.Direction, Map<Transaction.Channel, BigDecimal>> totals = transactionDao.totalsByChannel(account.getId(), from);
        List<TransactionRecord> recent = transactionDao.findRecent(account.getId(), RECENT_PER_ACCOUNT).stream()
                .filter(t -> !t.createdAt().isBefore(from))
                .toList();
        return new AccountSummary(account,
                sum(totals.get(Transaction.Direction.CREDIT)),
                sum(totals.get(Transaction.Direction.DEBIT)),
                totals.get(Transaction.Direction.DEBIT),
                recent);
    }

    private static BigDecimal sum(Map<?, BigDecimal> values) {
        return values.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static <K> Map<K, BigDecimal> sortedByValueDesc(Map<K, BigDecimal> map) {
        Map<K, BigDecimal> sorted = new LinkedHashMap<>();
        map.entrySet().stream()
                .sorted(Map.Entry.<K, BigDecimal>comparingByValue().reversed())
                .forEach(entry -> sorted.put(entry.getKey(), entry.getValue()));
        return sorted;
    }
}
