# Marking rubric: where each criterion is in the code

**Project:** Bharat National Bank, an online banking system
**Stack:** Java 17, Spring Boot (embedded Tomcat), JDBC, MySQL (H2 for the demo), React frontend

This page maps each item of the *Java Web Based Projects* rubric to the classes that meet it. It also covers the core-Java items from the GUI rubric: OOP, Collections & Generics, Multithreading & Synchronization, database classes, and JDBC. All paths are relative to `backend/src/main/java/com/banking/`.

---

## 1. Problem Understanding & Solution Design

**Problem.** Bank customers need to see their accounts, statements and spending at any time and move money safely. Branch staff need to manage customers, accounts, loans and settings. Two rules matter most: money must never be created or lost, even under concurrent requests, and customers must see only their own data.

**Solution.** A layered web application:

```
Browser ──► Servlet portal (/portal/*)   ──► DAO interfaces ──► JDBC (PreparedStatement) ──┐
   │        HttpServlet + Filter + Listener     (jdbc/)                                    ├──► MySQL / H2
   └──────► React app ──► REST API (/api/*) ──► Services ──► Spring Data JPA ──────────────┘
                                                (service/)
```

| Layer | Package | Responsibility |
|---|---|---|
| Presentation | `web/` (servlets), `controller/` (REST) | HTTP requests, sessions, HTML/JSON output |
| Business logic | `service/`, `core/` | Account rules, transfers, interest, reports, audit |
| Data access | `jdbc/` (raw JDBC), `repository/` (JPA) | SQL queries, transactions, mapping rows to objects |
| Database | `schema.sql`, `model/` | `users`, `accounts`, `transactions`, `portal_audit_log`, and more |

**Main entities:** User 1─* Account 1─* Transaction; User 1─* PortalAuditLog.

---

## 2. Core Java Concepts

### OOP: Inheritance, Polymorphism, Abstraction, Encapsulation

| Concept | Where | What it shows |
|---|---|---|
| Abstract class | [core/BankAccount.java](backend/src/main/java/com/banking/core/BankAccount.java) | Abstract `type()`, `productName()`, `features()`; private balance behind synchronized methods (encapsulation) |
| Inheritance (multi-level) | [SavingsAccount](backend/src/main/java/com/banking/core/SavingsAccount.java) → [SalaryAccount](backend/src/main/java/com/banking/core/SalaryAccount.java); [CurrentAccount](backend/src/main/java/com/banking/core/CurrentAccount.java) | `BankAccount → SavingsAccount → SalaryAccount`; `SalaryAccount.features()` calls `super.features()` |
| Polymorphism (overriding) | `monthlyInterest()` in each subclass | Savings and Salary earn interest; Current returns 0. [AccountsServlet](backend/src/main/java/com/banking/web/AccountsServlet.java) and [PortfolioReportService](backend/src/main/java/com/banking/service/PortfolioReportService.java) call it through a `BankAccount` reference |
| Factory method | `BankAccount.of(type, …)` | Builds the right subclass from a database row |
| Template method | [web/PortalServlet.java](backend/src/main/java/com/banking/web/PortalServlet.java) | `final doGet()` handles session, errors and audit; subclasses implement `render()` |
| `equals` / `hashCode` / `compareTo` / `toString` | `BankAccount` | Accounts compared and ordered by account number |

### Interfaces

| Interface | Implemented by |
|---|---|
| [core/InterestBearing](backend/src/main/java/com/banking/core/InterestBearing.java) (with a `default` method) | `BankAccount` and its subclasses |
| [jdbc/GenericDao&lt;T, ID&gt;](backend/src/main/java/com/banking/jdbc/GenericDao.java) | Extended by `AccountDao` and `TransactionDao` |
| [jdbc/AccountDao](backend/src/main/java/com/banking/jdbc/AccountDao.java), [TransactionDao](backend/src/main/java/com/banking/jdbc/TransactionDao.java), [AuditLogDao](backend/src/main/java/com/banking/jdbc/AuditLogDao.java) | `JdbcAccountDao`, `JdbcTransactionDao`, `JdbcAuditLogDao` |
| `Comparable<BankAccount>`, `Filter`, `ServletContextListener`, `HttpSessionListener`, `Serializable` | `BankAccount`, `PortalAuthFilter`, `PortalLifecycleListener`, `PortalUser` |

### Exception Handling

| Where | What it shows |
|---|---|
| [exception/BankingException](backend/src/main/java/com/banking/exception/BankingException.java) | Custom **checked** base exception |
| [InsufficientFundsException](backend/src/main/java/com/banking/exception/InsufficientFundsException.java), [AccountNotFoundException](backend/src/main/java/com/banking/exception/AccountNotFoundException.java), [DatabaseException](backend/src/main/java/com/banking/exception/DatabaseException.java) | Exception hierarchy; `DatabaseException` wraps `SQLException` (exception chaining) |
| `JdbcAuditLogDao.insertAll` | `try / catch / finally` with `rollback()` on failure; try-with-resources closes every `Connection`, `PreparedStatement` and `ResultSet` |
| `PortalServlet.doGet` | Multi-catch by type: bad input → 400, not found → 404, database error → 500 page |
| `PortfolioReportService.build` | Unwraps `ExecutionException`, handles `InterruptedException` and timeouts |
| [exception/GlobalExceptionHandler](backend/src/main/java/com/banking/exception/GlobalExceptionHandler.java) | One JSON error format for the REST API |

### Collections & Generics

| Where | Collections / Generics used |
|---|---|
| [core/Rankings.topN](backend/src/main/java/com/banking/core/Rankings.java) | Generic method `<T>` with wildcards `Collection<? extends T>`, `Comparator<? super T>`; `PriorityQueue` min-heap |
| [jdbc/JdbcTransactionDao.totalsByChannel](backend/src/main/java/com/banking/jdbc/JdbcTransactionDao.java) | Nested `EnumMap<Direction, EnumMap<Channel, BigDecimal>>` |
| [service/PortfolioReportService](backend/src/main/java/com/banking/service/PortfolioReportService.java) | `ArrayList`, `EnumMap.merge`, `LinkedHashMap` sorted by value, `TreeSet`, `ConcurrentHashMap.newKeySet()`, `Collections.unmodifiableList`, generic `sortedByValueDesc<K>` |
| [service/AuditLogger](backend/src/main/java/com/banking/service/AuditLogger.java) | `BlockingQueue` / `LinkedBlockingQueue`, `drainTo` |
| `GenericDao<T, ID>`, `ServletRegistrationBean<T>`, `Optional<T>` | Generic types throughout |

### Multithreading & Synchronization

| Where | What it shows |
|---|---|
| `BankAccount.deposit / withdraw / getBalance` | `synchronized` methods protect the balance |
| `BankAccount.transferTo` | Nested `synchronized` blocks taken in a fixed order (by account number), so opposite transfers cannot **deadlock** |
| [PortfolioReportService](backend/src/main/java/com/banking/service/PortfolioReportService.java) | `ExecutorService` fixed thread pool with a custom `ThreadFactory`; `Callable` tasks, `invokeAll` with a timeout, `Future.get` |
| [AuditLogger](backend/src/main/java/com/banking/service/AuditLogger.java) | **Producer-consumer**: request threads enqueue events and a background thread writes them in batches; `wait()` / `notifyAll()` in `flush()`; `volatile` flag; `AtomicLong` |
| [web/PortalLifecycleListener](backend/src/main/java/com/banking/web/PortalLifecycleListener.java) | `AtomicInteger` live-session counter shared by request threads |
| [LedgerService](backend/src/main/java/com/banking/service/LedgerService.java) (REST app) | Database row locks in a fixed id order for real-money transfers |
| [BankAccountTest](backend/src/test/java/com/banking/core/BankAccountTest.java) | 8 threads × 2,000 opposite transfers: the total stays the same and nothing deadlocks |

---

## 3. Database Integration (JDBC)

| Requirement | Where |
|---|---|
| Connection class | [jdbc/DBConnection.java](backend/src/main/java/com/banking/jdbc/DBConnection.java): `getConnection()` from the pooled `javax.sql.DataSource` (MySQL by default, H2 in the dev profile) |
| Classes for database operations (DAO pattern) | Interfaces `AccountDao`, `TransactionDao`, `AuditLogDao`; implementations [JdbcAccountDao](backend/src/main/java/com/banking/jdbc/JdbcAccountDao.java), [JdbcTransactionDao](backend/src/main/java/com/banking/jdbc/JdbcTransactionDao.java), [JdbcAuditLogDao](backend/src/main/java/com/banking/jdbc/JdbcAuditLogDao.java) |
| `PreparedStatement` with parameters (prevents SQL injection) | Every DAO query |
| `ResultSet` → Java objects | `JdbcAccountDao.map` creates the right `BankAccount` subclass; `JdbcTransactionDao.map` creates `TransactionRecord` |
| Aggregate SQL | `SUM(amount) … GROUP BY direction, channel` in `totalsByChannel` |
| DDL through JDBC | `JdbcAuditLogDao.createTableIfMissing` runs `CREATE TABLE IF NOT EXISTS portal_audit_log` with a `Statement` |
| Transactions | `JdbcAuditLogDao.insertAll`: `setAutoCommit(false)` → `addBatch` / `executeBatch` → `commit()`, `rollback()` on error |
| Batch processing | `addBatch()` / `executeBatch()` (up to 100 rows per batch from `AuditLogger`) |
| Data security | `findByIdForUser` (`WHERE id = ? AND user_id = ?`) stops customers reading other customers' accounts |

---

## 4. Servlets & Web Integration

All servlets extend `jakarta.servlet.http.HttpServlet` and run in Spring Boot's embedded Tomcat. [web/PortalWebConfig.java](backend/src/main/java/com/banking/web/PortalWebConfig.java) does the job of `web.xml`: it registers the servlet mappings, the filter and the listener.

| URL | Servlet | Method(s) | What it does |
|---|---|---|---|
| `/portal/login` | [LoginServlet](backend/src/main/java/com/banking/web/LoginServlet.java) | GET, POST | Form; reads `request.getParameter`, creates an `HttpSession`, prevents session fixation, 15-minute timeout |
| `/portal/logout` | [LogoutServlet](backend/src/main/java/com/banking/web/LogoutServlet.java) | POST | `session.invalidate()` and redirect |
| `/portal/accounts` | [AccountsServlet](backend/src/main/java/com/banking/web/AccountsServlet.java) | GET | Accounts table (JDBC + polymorphism) |
| `/portal/statement?accountId=` | [StatementServlet](backend/src/main/java/com/banking/web/StatementServlet.java) | GET | Mini statement; 400 for bad input, 404 for someone else's account |
| `/portal/report` | [ReportServlet](backend/src/main/java/com/banking/web/ReportServlet.java) | GET | 30-day report built on worker threads |
| `/portal/activity` | [ActivityServlet](backend/src/main/java/com/banking/web/ActivityServlet.java) | GET | Activity log read back from the JDBC audit table |

| Servlet API feature | Where |
|---|---|
| `Filter` (authentication) | [PortalAuthFilter](backend/src/main/java/com/banking/web/PortalAuthFilter.java) redirects to login when there is no session |
| `ServletContextListener` + `HttpSessionListener` | [PortalLifecycleListener](backend/src/main/java/com/banking/web/PortalLifecycleListener.java) stores the session counter in the `ServletContext` |
| `HttpSession` attributes | `PortalUser` (Serializable) stored under `portalUser` |
| `sendRedirect`, status codes, headers, `PrintWriter` | `PortalServlet`, [Html.send](backend/src/main/java/com/banking/web/Html.java) |
| Output encoding against XSS | `Html.esc` escapes all dynamic text |
| Secure session cookie | `HttpOnly` and `SameSite=Lax` in [application.properties](backend/src/main/resources/application.properties) |

The REST API (`controller/`) that serves the React app runs on Spring's `DispatcherServlet` (itself a servlet) behind a JWT `OncePerRequestFilter`: [security/JwtAuthFilter](backend/src/main/java/com/banking/security/JwtAuthFilter.java).

---

## How to demo

```bash
cd backend
# Windows (PowerShell): $env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

1. Open **http://localhost:8080/portal/login** and sign in as `priya.v@example.com` / `Customer@123`.
2. **Accounts:** the Savings and Current accounts show different interest (polymorphism).
3. **Mini statement:** transactions read through JDBC.
4. **30-day report:** the footer names the `report-worker-N` threads that built it.
5. **Activity:** every page you opened, written in batches by the background thread.
6. Try `/portal/statement?accountId=abc` (400) or another customer's account id (404).

Run the tests with `mvnw.cmd test`. [ServletPortalIntegrationTest](backend/src/test/java/com/banking/web/ServletPortalIntegrationTest.java) starts the real server and checks the servlets and DAOs end to end; [BankAccountTest](backend/src/test/java/com/banking/core/BankAccountTest.java) covers OOP, the exceptions and thread safety.
