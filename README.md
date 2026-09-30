# Bharat National Bank — Online Banking System

An SBI-style internet banking system: a Spring Boot + JWT backend with a real ledger, and a React frontend built on [Untitled UI React](https://www.untitledui.com/react) (Tailwind CSS v4 + React Aria).

## Features

**Customers**
- Sign up online with KYC (PAN, Aadhaar, date of birth), or log in with email or 11-digit Customer ID (CIF)
- Dashboard: total balance, accounts, money in vs out chart, FD and loan summary, today's transfer limit
- Multiple accounts (Savings, Current, Salary) with a UPI ID, IFSC and nominee
- Fund transfer between own accounts, to payees within the bank, and to other banks by IMPS, NEFT or RTGS; UPI payments to UPI IDs, with name verification
- Payee management with a 24-hour cooling cap on new payees (₹25,000) and a per-payee limit
- Passbook with running balance, filters, search, and CSV statement download
- Fixed deposits: rate slabs, senior-citizen rates, live maturity preview, premature closure with a 0.5% penalty, and automatic maturity or renewal
- Loans (home, personal, car, education, gold): EMI calculator, online application, EMI repayment and prepayment
- Debit cards: block and unblock, report lost/stolen (automatically raises a replacement request), toggles for online, international, contactless and ATM use, and daily limits
- BBPS-style bill payments and recharges (electricity, mobile, DTH, water, gas, broadband, FASTag, insurance, credit card)
- Service requests: cheque book, stop cheque, card reissue, address, nominee, KYC, account closure
- Notifications for every transaction and security event, profile edits, password change, and a 6-digit transaction PIN

**Branch admin console**
- Overview KPIs, 14-day volume chart and payment-channel breakdown
- Customers: search, onboard with an opening deposit, suspend, reactivate or unlock
- Accounts: freeze or unfreeze, branch cash deposit and withdrawal
- Bank-wide transaction ledger with filters
- Loan approvals (approval disburses the loan and charges the processing fee) and the service-request queue
- Bank settings (daily, UPI, IMPS and RTGS limits, login attempts, interest rate, maintenance mode) and monthly savings interest credit

**Security and correctness**
- BCrypt passwords and PINs, stateless JWT, admin-only `/api/admin/**`, and customers can see only their own data
- Account locked after repeated failed logins; suspended or locked users are cut off immediately
- Every debit needs the transaction PIN; balances change only in `LedgerService`, under row locks taken in a fixed order
- `BigDecimal` money, validation with field-level error messages, and consistent JSON errors

## Run it

Requirements: **JDK 17+** and **Node 20+**. MySQL is optional.

**Backend** (port 8080):

```bash
cd backend
# Quickest start: in-memory H2 database, demo data reloaded on every start
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev        # Windows: mvnw.cmd ...

# Or use MySQL (creates banking_db automatically; set DB_USERNAME / DB_PASSWORD, default root/root)
./mvnw spring-boot:run
```

**Frontend** (port 5173; `/api` is proxied to the backend):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

| Role | Login | Password | Transaction PIN |
|---|---|---|---|
| Customer | `priya.v@example.com` | `Customer@123` | `123456` |
| Customer | `amit.p@example.com` | `Customer@123` | `123456` |
| Admin | `admin@bank.com` | `Admin@123` | — |

`rohan.m@example.com` is seeded as a locked account, so you can try the admin unlock flow.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `DB_USERNAME` / `DB_PASSWORD` | `root` / `root` | MySQL credentials |
| `JWT_SECRET` | dev-only value | Base64 HMAC key (256+ bits). **Set this outside local dev.** |
| `JWT_EXPIRATION_MINUTES` | `60` | Session length |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins (comma-separated) |

## Project layout

```
backend/src/main/java/com/banking/
  controller/   AuthController, BankingApiController (customer), AdminController
  service/      LedgerService (all balance changes), TransferService, DepositService, LoanService, ...
  model/        JPA entities; repository/ Spring Data; dto/ request and response records
  security/     JWT filter; config/ security and demo-data seeder
frontend/src/
  lib/          types.ts (API contract), api.ts (client), format.ts (₹ and date helpers)
  components/   base/ and application/ = Untitled UI; app/ = bank shell, modals, tables
  pages/        customer pages; pages/admin/ admin console
```
