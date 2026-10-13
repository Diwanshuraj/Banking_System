package com.banking.web;

import com.banking.core.BankAccount;
import com.banking.core.CurrentAccount;
import com.banking.core.SavingsAccount;
import com.banking.jdbc.AccountDao;
import com.banking.jdbc.AuditEvent;
import com.banking.jdbc.AuditLogDao;
import com.banking.jdbc.TransactionDao;
import com.banking.repository.UserRepository;
import com.banking.service.PortfolioReportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import java.net.CookieManager;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs the real app on H2 (dev profile, demo data) and drives the JDBC layer and the servlets. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev")
class ServletPortalIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    AccountDao accountDao;
    @Autowired
    TransactionDao transactionDao;
    @Autowired
    AuditLogDao auditLogDao;
    @Autowired
    PortfolioReportService reportService;
    @Autowired
    UserRepository userRepository;

    private long userId(String email) {
        return userRepository.findByEmailIgnoreCase(email).orElseThrow().getId();
    }

    // ---------- JDBC layer ----------

    @Test
    void accountDaoMapsRowsToSubclassesAndScopesByOwner() throws Exception {
        long priya = userId("priya.v@example.com");
        long amit = userId("amit.p@example.com");

        List<BankAccount> accounts = accountDao.findByUserId(priya);
        assertThat(accounts).hasSize(2);
        assertThat(accounts.get(0)).isInstanceOf(SavingsAccount.class);
        assertThat(accounts.get(1)).isInstanceOf(CurrentAccount.class);

        long priyaAccount = accounts.get(0).getId();
        assertThat(accountDao.findById(priyaAccount)).isPresent();
        assertThat(accountDao.findByIdForUser(priyaAccount, priya)).isPresent();
        assertThat(accountDao.findByIdForUser(priyaAccount, amit)).isEmpty();
    }

    @Test
    void transactionDaoReadsTheLatestEntriesNewestFirst() throws Exception {
        long accountId = accountDao.findByUserId(userId("priya.v@example.com")).get(0).getId();
        var recent = transactionDao.findRecent(accountId, 10);
        assertThat(recent).hasSize(10);
        assertThat(recent.get(0).createdAt()).isAfterOrEqualTo(recent.get(9).createdAt());
        assertThat(transactionDao.findById(recent.get(0).id())).contains(recent.get(0));
    }

    @Test
    void auditBatchIsWrittenAndReadBack() throws Exception {
        long amit = userId("amit.p@example.com");
        LocalDateTime now = LocalDateTime.now().withNano(0);
        auditLogDao.insertAll(List.of(
                new AuditEvent(amit, "TEST_A", "first", "127.0.0.1", now.minusSeconds(1)),
                new AuditEvent(amit, "TEST_B", "second", "127.0.0.1", now)));
        assertThat(auditLogDao.findRecentByUser(amit, 2)).extracting(AuditEvent::action).containsExactly("TEST_B", "TEST_A");
    }

    @Test
    void reportSummarisesEveryAccountOnWorkerThreads() throws Exception {
        long priya = userId("priya.v@example.com");
        var report = reportService.build(priya);
        assertThat(report.accounts()).hasSize(2);
        assertThat(report.workerThreads()).isNotEmpty().allMatch(name -> name.startsWith("report-worker-"));
        assertThat(report.totalBalance()).isEqualByComparingTo(
                accountDao.findByUserId(priya).stream().map(BankAccount::getBalance).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));
        assertThat(report.largestTransactions()).hasSizeLessThanOrEqualTo(5);
    }

    // ---------- Servlets ----------

    private final HttpClient http = HttpClient.newBuilder()
            .cookieHandler(new CookieManager())
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, String form) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String form(String username, String password) {
        return "username=" + URLEncoder.encode(username, StandardCharsets.UTF_8)
                + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8);
    }

    @Test
    void portalRequiresLoginAndShowsOnlyTheCustomersOwnData() throws Exception {
        HttpResponse<String> anonymous = get("/portal/accounts");
        assertThat(anonymous.statusCode()).isEqualTo(302);
        assertThat(anonymous.headers().firstValue("Location")).hasValueSatisfying(l -> assertThat(l).endsWith("/portal/login"));

        assertThat(get("/portal/login").body()).contains("Sign in");

        HttpResponse<String> login = post("/portal/login", form("priya.v@example.com", "Customer@123"));
        assertThat(login.statusCode()).isEqualTo(302);

        long priya = userId("priya.v@example.com");
        BankAccount own = accountDao.findByUserId(priya).get(0);
        HttpResponse<String> accounts = get("/portal/accounts");
        assertThat(accounts.statusCode()).isEqualTo(200);
        assertThat(accounts.body()).contains("Priya Verma", own.getAccountNumber(), "Savings Account", "Current Account",
                "Active portal sessions: ");

        assertThat(get("/portal/statement?accountId=" + own.getId()).body()).contains("Mini statement", own.getAccountNumber());

        long amitAccount = accountDao.findByUserId(userId("amit.p@example.com")).get(0).getId();
        assertThat(get("/portal/statement?accountId=" + amitAccount).statusCode()).isEqualTo(404);
        assertThat(get("/portal/statement?accountId=abc").statusCode()).isEqualTo(400);

        HttpResponse<String> report = get("/portal/report");
        assertThat(report.statusCode()).isEqualTo(200);
        assertThat(report.body()).contains("report-worker-");

        HttpResponse<String> activity = get("/portal/activity");
        assertThat(activity.body()).contains("LOGIN", "/portal/statement");

        HttpResponse<String> logout = post("/portal/logout", "");
        assertThat(logout.statusCode()).isEqualTo(302);
        assertThat(get("/portal/accounts").statusCode()).isEqualTo(302);
    }

    @Test
    void wrongPasswordShowsTheErrorAndAdminsAreTurnedAway() throws Exception {
        HttpResponse<String> wrong = post("/portal/login", form("amit.p@example.com", "nope"));
        assertThat(wrong.statusCode()).isEqualTo(401);
        assertThat(wrong.body()).contains("Incorrect username or password");

        HttpResponse<String> admin = post("/portal/login", form("admin@bank.com", "Admin@123"));
        assertThat(admin.statusCode()).isEqualTo(403);
        assertThat(get("/portal/accounts").statusCode()).isEqualTo(302);
    }
}
