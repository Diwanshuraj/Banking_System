package com.banking.core;

import com.banking.exception.BankingException;
import com.banking.exception.InsufficientFundsException;
import com.banking.model.Account;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BankAccountTest {

    private static BankAccount account(Account.AccountType type, String number, String balance) {
        return BankAccount.of(type, 1, 1, number, new BigDecimal(balance), Account.AccountStatus.ACTIVE, new BigDecimal("3.00"));
    }

    @Test
    void factoryBuildsTheRightSubclassAndInterestIsPolymorphic() {
        BankAccount savings = account(Account.AccountType.SAVINGS, "10000000001", "120000");
        BankAccount salary = account(Account.AccountType.SALARY, "10000000002", "120000");
        BankAccount current = account(Account.AccountType.CURRENT, "10000000003", "120000");

        assertThat(savings).isExactlyInstanceOf(SavingsAccount.class);
        assertThat(salary).isExactlyInstanceOf(SalaryAccount.class).isInstanceOf(SavingsAccount.class);
        assertThat(current).isExactlyInstanceOf(CurrentAccount.class);

        // 120000 * 3% / 12 = 300
        assertThat(savings.monthlyInterest()).isEqualByComparingTo("300.00");
        assertThat(salary.monthlyInterest()).isEqualByComparingTo("300.00");
        assertThat(current.monthlyInterest()).isEqualByComparingTo("0");
        assertThat(savings.yearlyInterestEstimate()).isEqualByComparingTo("3600.00");
        assertThat(List.of(savings, salary, current)).extracting(BankAccount::productName)
                .containsExactly("Savings Account", "Salary Account", "Current Account");
    }

    @Test
    void withdrawRejectsOverdraftsAndBadAmounts() {
        BankAccount savings = account(Account.AccountType.SAVINGS, "10000000001", "500");

        assertThatThrownBy(() -> savings.withdraw(new BigDecimal("500.01")))
                .isInstanceOf(InsufficientFundsException.class)
                .hasMessageContaining("ending 0001");
        assertThatThrownBy(() -> savings.withdraw(BigDecimal.ZERO)).isInstanceOf(BankingException.class);
        assertThatThrownBy(() -> savings.deposit(new BigDecimal("1.001"))).isInstanceOf(BankingException.class);
        assertThat(savings.getBalance()).isEqualByComparingTo("500");
    }

    @Test
    void frozenAccountsCannotBeDebited() {
        BankAccount frozen = BankAccount.of(Account.AccountType.SAVINGS, 1, 1, "10000000009", new BigDecimal("1000"),
                Account.AccountStatus.FROZEN, new BigDecimal("3.00"));
        assertThatThrownBy(() -> frozen.withdraw(BigDecimal.TEN)).hasMessageContaining("frozen");
    }

    @Test
    void failedTransferLeavesBothBalancesUnchanged() {
        BankAccount a = account(Account.AccountType.SAVINGS, "10000000001", "100");
        BankAccount b = account(Account.AccountType.CURRENT, "10000000002", "100");

        assertThatThrownBy(() -> a.transferTo(b, new BigDecimal("150"))).isInstanceOf(InsufficientFundsException.class);
        assertThat(a.getBalance()).isEqualByComparingTo("100");
        assertThat(b.getBalance()).isEqualByComparingTo("100");
    }

    /**
     * 8 threads move money both ways between two accounts at once. Without synchronization the
     * total would drift; with the wrong lock order the threads would deadlock and time out.
     */
    @Test
    void concurrentOppositeTransfersKeepTheTotalAndDoNotDeadlock() throws Exception {
        BankAccount a = account(Account.AccountType.SAVINGS, "10000000001", "10000");
        BankAccount b = account(Account.AccountType.SAVINGS, "10000000002", "10000");
        int threads = 8;
        int transfersPerThread = 2_000;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            boolean aToB = t % 2 == 0;
            futures.add(pool.submit(() -> {
                start.await();
                for (int i = 0; i < transfersPerThread; i++) {
                    try {
                        if (aToB) a.transferTo(b, BigDecimal.ONE);
                        else b.transferTo(a, BigDecimal.ONE);
                    } catch (InsufficientFundsException ignored) {
                        // Possible when one side runs dry; the total must still be conserved.
                    }
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> future : futures) future.get(30, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(a.getBalance().add(b.getBalance())).isEqualByComparingTo("20000");
    }

    @Test
    void topNReturnsLargestFirst() {
        assertThat(Rankings.topN(List.of(5, 1, 9, 3, 7), 3, Integer::compare)).containsExactly(9, 7, 5);
        assertThat(Rankings.topN(List.of(2, 1), 5, Integer::compare)).containsExactly(2, 1);
        assertThat(Rankings.topN(List.of(1), 0, Integer::compare)).isEmpty();
    }
}
