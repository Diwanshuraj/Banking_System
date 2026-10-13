package com.banking.config;

import com.banking.model.*;
import com.banking.repository.*;
import com.banking.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

/**
 * Creates default settings on every start and, on first start with an empty
 * database, a set of demo
 * customers with six months of consistent history (every balanceAfter adds up).
 * <p>
 * Demo logins: admin@bank.com / Admin@123 and priya.v@example.com /
 * Customer@123 (transaction PIN 123456).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {

        private final SettingsService settings;
        private final DepositService depositService;
        private final UserRepository userRepository;
        private final TransactionRepository transactionRepository;
        private final BeneficiaryRepository beneficiaryRepository;
        private final FixedDepositRepository fdRepository;
        private final LoanRepository loanRepository;
        private final ServiceRequestRepository requestRepository;
        private final NotificationRepository notificationRepository;
        private final DebitCardRepository cardRepository;
        private final OnboardingService onboarding;
        private final PasswordEncoder passwordEncoder;
        private final IdGenerator ids;

        @Value("${bank.seed-demo-data:true}")
        private boolean seedDemoData;

        private final Random random = new Random(20260901);
        private final List<Posting> postings = new ArrayList<>();

        @Override
        @Transactional
        public void run(ApplicationArguments args) {
                settings.ensureDefaults();
                if (seedDemoData && userRepository.count() == 0) {
                        seed();
                        log.info("Seeded demo data. Customer login: priya.v@example.com / Customer@123 (PIN 123456). Admin: admin@bank.com / Admin@123");
                }
                depositService.processMaturities();
        }

        // ---------------------------------------------------------------------------------------------

        private record Posting(LocalDateTime at, int order, Account account, Transaction.Direction direction,
                        Transaction.Channel channel, BigDecimal amount, String reference, String counterpartyName,
                        String counterpartyAccount, String description, boolean self) {
        }

        private void seed() {
                LocalDateTime now = LocalDateTime.now();

                User admin = new User();
                admin.setCustomerId(ids.customerId());
                admin.setFullName("Bharat National Bank");
                admin.setEmail("admin@bank.com");
                admin.setPhone("+91 98765-43210");
                admin.setPasswordHash(passwordEncoder.encode("Admin@123"));
                admin.setRole(User.Role.ROLE_ADMIN);
                admin.setCreatedAt(now.minusYears(3));
                userRepository.save(admin);

                User priya = customer("Priya Verma", "priya.v@example.com", "9812345678", "BKZPV9876Q", "987654321098",
                                LocalDate.of(1992, 4, 18),
                                "Flat 12B, Green Park Apartments, Hauz Khas, New Delhi 110016",
                                now.minusYears(2).minusMonths(4));
                User amit = customer("Amit Patel", "amit.p@example.com", "9765432109", "CLMAP4321R", "456789012345",
                                LocalDate.of(1988, 11, 2), "22 Shanti Nagar, Navrangpura, Ahmedabad 380009",
                                now.minusYears(3));
                User sneha = customer("Sneha Iyer", "sneha.iyer@example.com", "9900112233", "AKIPI2468K",
                                "234567890123",
                                LocalDate.of(1995, 7, 25), "7 Lake View Road, Indiranagar, Bengaluru 560038",
                                now.minusMonths(8));
                User rohan = customer("Rohan Mehta", "rohan.m@example.com", "9822001144", "BQRPM1357L", "345678901234",
                                LocalDate.of(1990, 1, 9), "B-404 Sea Breeze, Andheri West, Mumbai 400053",
                                now.minusMonths(14));
                User kavya = customer("Kavya Nair", "kavya.nair@example.com", "9447012345", "CNKPN8642M",
                                "567890123456",
                                LocalDate.of(1961, 3, 30), "Nair Villa, MG Road, Kochi 682016", now.minusYears(5));

                Account priyaSavings = account(priya, Account.AccountType.SAVINGS, "Anita Verma",
                                now.minusYears(2).minusMonths(4));
                Account priyaCurrent = account(priya, Account.AccountType.CURRENT, null, now.minusMonths(20));
                Account amitSavings = account(amit, Account.AccountType.SAVINGS, "Neha Patel", now.minusYears(3));
                Account snehaSalary = account(sneha, Account.AccountType.SALARY, null, now.minusMonths(8));
                Account rohanSavings = account(rohan, Account.AccountType.SAVINGS, null, now.minusMonths(14));
                Account kavyaCurrent = account(kavya, Account.AccountType.CURRENT, "Arjun Nair", now.minusYears(5));

                // Opening deposits.
                post(priyaSavings.getOpenedAt(), priyaSavings, Transaction.Direction.CREDIT, Transaction.Channel.CASH,
                                "150000", "Branch cash deposit", null, "Opening deposit");
                post(priyaCurrent.getOpenedAt(), priyaCurrent, Transaction.Direction.CREDIT, Transaction.Channel.CASH,
                                "25000", "Branch cash deposit", null, "Opening deposit");
                post(amitSavings.getOpenedAt(), amitSavings, Transaction.Direction.CREDIT, Transaction.Channel.CASH,
                                "210000", "Branch cash deposit", null, "Opening deposit");
                post(snehaSalary.getOpenedAt(), snehaSalary, Transaction.Direction.CREDIT, Transaction.Channel.CASH,
                                "10000", "Branch cash deposit", null, "Opening deposit");
                post(rohanSavings.getOpenedAt(), rohanSavings, Transaction.Direction.CREDIT, Transaction.Channel.CASH,
                                "30000", "Branch cash deposit", null, "Opening deposit");
                post(kavyaCurrent.getOpenedAt(), kavyaCurrent, Transaction.Direction.CREDIT, Transaction.Channel.CASH,
                                "400000", "Branch cash deposit", null, "Opening deposit");

                String[][] merchants = {
                                { "BigBasket", "bigbasket@hdfcbank" }, { "Swiggy", "swiggy@icici" },
                                { "Zomato", "zomato@kotak" },
                                { "Uber India", "uber@axisbank" }, { "DMart Ready", "dmart@yesbank" },
                                { "Apollo Pharmacy", "apollo@icici" },
                                { "IRCTC", "irctc@sbi" }, { "Amazon Pay", "amazonpay@apl" },
                                { "Chai Point", "chaipoint@paytm" }, { "Reliance Trends", "trends@hdfcbank" } };

                // Six months of everyday banking, plus the current month up to today.
                for (int m = 6; m >= 0; m--) {
                        YearMonth month = YearMonth.now().minusMonths(m);
                        post(at(month, 1, 9, 30), priyaSavings, Transaction.Direction.CREDIT, Transaction.Channel.NEFT,
                                        "92500",
                                        "Infosys Limited", "HDFC0000128 / 50200012345678",
                                        "Salary for " + month.minusMonths(1).getMonth());
                        post(at(month, 1, 10, 5), amitSavings, Transaction.Direction.CREDIT, Transaction.Channel.NEFT,
                                        "145000",
                                        "Tata Consultancy Services", "SBIN0001234 / 30098765432",
                                        "Salary for " + month.minusMonths(1).getMonth());
                        if (m <= 7) {
                                post(at(month, 1, 11, 0), snehaSalary, Transaction.Direction.CREDIT,
                                                Transaction.Channel.NEFT, "78000",
                                                "Wipro Limited", "ICIC0000045 / 004501234567",
                                                "Salary for " + month.minusMonths(1).getMonth());
                        }
                        post(at(month, 3, 8, 45), priyaSavings, Transaction.Direction.DEBIT, Transaction.Channel.IMPS,
                                        "22000",
                                        "Ramesh Kumar", "50100234567812", "Rent");
                        post(at(month, 3, 9, 10), amitSavings, Transaction.Direction.DEBIT, Transaction.Channel.IMPS,
                                        "35000",
                                        "Shanti Housing Society", "UTIB0000210 / 921010012345678",
                                        "Rent and maintenance");
                        post(at(month, 5, 19, 20), priyaSavings, Transaction.Direction.DEBIT,
                                        Transaction.Channel.BILL_PAYMENT,
                                        amount(1100, 2600), "BSES Rajdhani Power", "CA102938475",
                                        "Electricity payment");
                        post(at(month, 6, 12, 0), priyaSavings, Transaction.Direction.DEBIT,
                                        Transaction.Channel.BILL_PAYMENT, "299",
                                        "Jio Prepaid", "9812345678", "Mobile recharge payment");
                        post(at(month, 10, 16, 40), priyaCurrent, Transaction.Direction.CREDIT,
                                        Transaction.Channel.NEFT, amount(15000, 26000),
                                        "Acme Design Studio", "KKBK0000811 / 811234567890", "Freelance invoice");
                        post(at(month, 12, 14, 5), kavyaCurrent, Transaction.Direction.CREDIT, Transaction.Channel.RTGS,
                                        amount(200000, 350000),
                                        "Kerala Spices Exports", "CNRB0001122 / 1122334455667", "Invoice settlement");
                        post(at(month, 18, 11, 30), kavyaCurrent, Transaction.Direction.DEBIT, Transaction.Channel.NEFT,
                                        amount(120000, 180000),
                                        "Malabar Logistics", "FDRL0001234 / 12340100056789", "Freight charges");
                        post(at(month, 14, 10, 0), rohanSavings, Transaction.Direction.DEBIT, Transaction.Channel.UPI,
                                        amount(800, 3500),
                                        "Myntra", "myntra@icici", "UPI payment");

                        // Everyday UPI spends.
                        for (int i = 0; i < 6; i++) {
                                String[] merchant = merchants[random.nextInt(merchants.length)];
                                post(at(month, 2 + random.nextInt(26), 8 + random.nextInt(13), random.nextInt(60)),
                                                priyaSavings,
                                                Transaction.Direction.DEBIT, Transaction.Channel.UPI, amount(120, 3800),
                                                merchant[0], merchant[1], "UPI payment");
                                String[] other = merchants[random.nextInt(merchants.length)];
                                post(at(month, 2 + random.nextInt(26), 8 + random.nextInt(13), random.nextInt(60)),
                                                amitSavings,
                                                Transaction.Direction.DEBIT, Transaction.Channel.UPI, amount(150, 4200),
                                                other[0], other[1], "UPI payment");
                                if (i < 3) {
                                        String[] third = merchants[random.nextInt(merchants.length)];
                                        post(at(month, 2 + random.nextInt(26), 9 + random.nextInt(12),
                                                        random.nextInt(60)), snehaSalary,
                                                        Transaction.Direction.DEBIT, Transaction.Channel.UPI,
                                                        amount(150, 2500), third[0], third[1], "UPI payment");
                                }
                        }

                        // Priya splits bills with Amit over UPI, and moves money to her current
                        // account.
                        transfer(at(month, 20, 21, 15), priyaSavings, amitSavings, Transaction.Channel.UPI,
                                        amount(800, 2800),
                                        "Dinner split", priya, amit, false);
                        if (m % 2 == 0) {
                                transfer(at(month, 15, 13, 0), priyaSavings, priyaCurrent, Transaction.Channel.INTERNAL,
                                                "5000",
                                                "Transfer to own current account", priya, priya, true);
                        }
                }
                transfer(now.minusDays(9), amitSavings, priyaSavings, Transaction.Channel.IMPS, "4500",
                                "Concert tickets", amit, priya, false);

                // Fixed deposits: one running, one matured and paid out.
                LocalDate fdStart = LocalDate.now().minusMonths(5).withDayOfMonth(8);
                FixedDeposit activeFd = fd(priya, priyaSavings, "100000", 12, fdStart, false);
                post(fdStart.atTime(11, 0), priyaSavings, Transaction.Direction.DEBIT,
                                Transaction.Channel.FIXED_DEPOSIT, "100000",
                                "Fixed deposit " + activeFd.getFdNumber(), null, "Fixed deposit opened for 12 months",
                                activeFd.getFdNumber(), true);
                LocalDate oldFdStart = LocalDate.now().minusMonths(14).withDayOfMonth(2);
                FixedDeposit maturedFd = fd(priya, priyaSavings, "50000", 12, oldFdStart, false);
                maturedFd.setStatus(FixedDeposit.FdStatus.MATURED);
                maturedFd.setClosedAt(maturedFd.getMaturityDate().atTime(0, 15));
                maturedFd.setPayoutAmount(maturedFd.getMaturityAmount());
                post(oldFdStart.atTime(10, 0), priyaSavings, Transaction.Direction.DEBIT,
                                Transaction.Channel.FIXED_DEPOSIT, "50000",
                                "Fixed deposit " + maturedFd.getFdNumber(), null, "Fixed deposit opened for 12 months",
                                maturedFd.getFdNumber(), true);
                post(maturedFd.getMaturityDate().atTime(0, 15), priyaSavings, Transaction.Direction.CREDIT,
                                Transaction.Channel.FIXED_DEPOSIT,
                                maturedFd.getMaturityAmount().toPlainString(),
                                "Fixed deposit " + maturedFd.getFdNumber(), null,
                                "Fixed deposit maturity proceeds", maturedFd.getFdNumber(), true);
                FixedDeposit kavyaFd = fd(kavya, kavyaCurrent, "500000", 36, LocalDate.now().minusMonths(10), true);
                post(kavyaFd.getStartDate().atTime(12, 0), kavyaCurrent, Transaction.Direction.DEBIT,
                                Transaction.Channel.FIXED_DEPOSIT, "500000",
                                "Fixed deposit " + kavyaFd.getFdNumber(), null, "Fixed deposit opened for 36 months",
                                kavyaFd.getFdNumber(), true);

                // An active personal loan with four EMIs paid, and a home loan waiting for
                // approval.
                LocalDateTime disbursed = LocalDate.now().minusMonths(4).withDayOfMonth(6).atTime(15, 0);
                Loan personal = loan(priya, priyaSavings, Loan.LoanType.PERSONAL, "300000", 36, "Home renovation",
                                "92500", disbursed.minusDays(3));
                personal.setStatus(Loan.LoanStatus.ACTIVE);
                personal.setDecidedAt(disbursed);
                personal.setRemarks("Approved: salaried, CIBIL 781");
                post(disbursed, priyaSavings, Transaction.Direction.CREDIT, Transaction.Channel.LOAN, "300000",
                                BankConstants.BANK_NAME, personal.getLoanNumber(), "Personal loan disbursement",
                                personal.getLoanNumber(), true);
                post(disbursed.plusMinutes(1), priyaSavings, Transaction.Direction.DEBIT, Transaction.Channel.LOAN,
                                "4500",
                                BankConstants.BANK_NAME, personal.getLoanNumber(), "Personal loan processing fee",
                                personal.getLoanNumber(), true);
                BigDecimal outstanding = personal.getPrincipal();
                LocalDate due = disbursed.toLocalDate().plusMonths(1).withDayOfMonth(7);
                while (!due.isAfter(LocalDate.now())) {
                        BigDecimal interest = FinanceMath.monthlyInterest(outstanding, personal.getInterestRate());
                        outstanding = outstanding.subtract(personal.getEmi().subtract(interest));
                        post(due.atTime(7, 0), priyaSavings, Transaction.Direction.DEBIT, Transaction.Channel.LOAN,
                                        personal.getEmi().toPlainString(),
                                        "Loan " + personal.getLoanNumber(), personal.getLoanNumber(),
                                        "Loan EMI / prepayment", ids.reference("LOAN"), true);
                        personal.setEmisPaid(personal.getEmisPaid() + 1);
                        due = due.plusMonths(1);
                }
                personal.setOutstanding(outstanding);
                personal.setNextDueDate(due);

                loan(amit, amitSavings, Loan.LoanType.HOME, "4500000", 240,
                                "Purchase of 2BHK flat in Satellite, Ahmedabad", "145000", now.minusDays(2));
                loan(sneha, snehaSalary, Loan.LoanType.PERSONAL, "900000", 48, "Wedding expenses", "78000",
                                now.minusHours(20));
                Loan rejected = loan(rohan, rohanSavings, Loan.LoanType.CAR, "1500000", 84, "New SUV", "42000",
                                now.minusMonths(2));
                rejected.setStatus(Loan.LoanStatus.REJECTED);
                rejected.setDecidedAt(now.minusMonths(2).plusDays(2));
                rejected.setRemarks("EMI exceeds 50% of declared income");

                applyPostings();

                // Payees: an internal friend, an external landlord, and one still in its
                // 24-hour cooling period.
                payee(priya, "Amit Patel", "Amit", amitSavings.getAccountNumber(), BankConstants.HOME_IFSC, "100000",
                                now.minusDays(60));
                payee(priya, "Ramesh Kumar", "Landlord", "50100234567812", "HDFC0001234", "50000", now.minusDays(200));
                payee(priya, "Anita Verma", "Mom", "30012345678", "SBIN0001234", "100000", now.minusHours(2));
                payee(amit, "Priya Verma", null, priyaSavings.getAccountNumber(), BankConstants.HOME_IFSC, "50000",
                                now.minusDays(90));

                // Card states and service requests.
                cardRepository.findByAccountUserIdOrderByIdAsc(priya.getId()).stream()
                                .filter(c -> c.getAccount().getId().equals(priyaCurrent.getId()))
                                .forEach(c -> c.setStatus(DebitCard.CardStatus.BLOCKED));
                request(priya, priyaSavings, ServiceRequest.RequestType.CHEQUE_BOOK, "Cheque book with 25 leaves",
                                ServiceRequest.RequestStatus.COMPLETED, "Dispatched by Speed Post, AWB EK482913605IN",
                                now.minusDays(40));
                request(amit, amitSavings, ServiceRequest.RequestType.ADDRESS_CHANGE,
                                "New address: 22 Shanti Nagar, Navrangpura, Ahmedabad 380009",
                                ServiceRequest.RequestStatus.OPEN, null, now.minusDays(1));
                request(sneha, snehaSalary, ServiceRequest.RequestType.KYC_UPDATE,
                                "Update PAN linked to account (document: PAN card)",
                                ServiceRequest.RequestStatus.IN_PROGRESS, "Documents under verification",
                                now.minusDays(3));

                // Rohan locked himself out; Kavya's account is under review.
                rohan.setStatus(User.UserStatus.LOCKED);
                rohan.setFailedLoginAttempts(5);
                kavyaCurrent.setStatus(Account.AccountStatus.FROZEN);

                // Replace onboarding's "now" notifications with a realistic inbox.
                notificationRepository.deleteAll();
                notification(priya, Notification.Category.TRANSACTION, "Salary credited",
                                "₹92,500.00 credited to account ending " + last4(priyaSavings)
                                                + " from Infosys Limited via NEFT.",
                                now.minusHours(3), false);
                notification(priya, Notification.Category.SECURITY, "New payee added",
                                "Anita Verma (State Bank of India, account ending 5678) was added. Transfers to new payees are capped at ₹25,000 for 24 hours.",
                                now.minusHours(2), false);
                notification(priya, Notification.Category.LOAN, "EMI debited",
                                "₹" + personal.getEmi().toPlainString() + " EMI for loan " + personal.getLoanNumber()
                                                + " was debited.",
                                now.minusDays(24), false);
                notification(priya, Notification.Category.ACCOUNT, "Fixed deposit matured",
                                "₹" + maturedFd.getMaturityAmount().toPlainString() + " from FD "
                                                + maturedFd.getFdNumber() + " was credited to your savings account.",
                                maturedFd.getMaturityDate().atTime(0, 15), true);
                notification(priya, Notification.Category.GENERAL, "Cheque book dispatched",
                                "Your cheque book was dispatched by Speed Post (AWB EK482913605IN).", now.minusDays(38),
                                true);
                notification(amit, Notification.Category.LOAN, "Loan application received",
                                "Home loan application for ₹45,00,000 is under review.", now.minusDays(2), false);
                notification(rohan, Notification.Category.SECURITY, "Internet banking locked",
                                "Your access was locked after 5 failed login attempts. Visit your branch to unlock it.",
                                now.minusDays(1), false);
        }

        private User customer(String name, String email, String phone, String pan, String aadhaar, LocalDate dob,
                        String address, LocalDateTime joined) {
                User user = onboarding.createCustomer(new OnboardingService.NewCustomer(name, email, phone,
                                "Customer@123", pan, aadhaar, dob, address));
                user.setTransactionPinHash(passwordEncoder.encode("123456"));
                user.setCreatedAt(joined);
                user.setLastLoginAt(LocalDateTime.now().minusDays(1 + random.nextInt(4)).withHour(19)
                                .withMinute(random.nextInt(60)));
                return user;
        }

        private Account account(User user, Account.AccountType type, String nominee, LocalDateTime opened) {
                Account account = onboarding.openAccount(user, type, nominee);
                account.setOpenedAt(opened);
                return account;
        }

        private FixedDeposit fd(User user, Account source, String principal, int months, LocalDate start,
                        boolean autoRenew) {
                BigDecimal amount = new BigDecimal(principal);
                BigDecimal rate = DepositService.rateFor(months, user.isSeniorCitizen());
                FixedDeposit fd = new FixedDeposit();
                fd.setFdNumber("FD" + ids.digits(10));
                fd.setUser(user);
                fd.setSourceAccount(source);
                fd.setPrincipal(amount.setScale(2));
                fd.setInterestRate(rate);
                fd.setTenureMonths(months);
                fd.setStartDate(start);
                fd.setMaturityDate(start.plusMonths(months));
                fd.setMaturityAmount(FinanceMath.fdMaturity(amount, rate, months));
                fd.setAutoRenew(autoRenew);
                return fdRepository.save(fd);
        }

        private Loan loan(User user, Account account, Loan.LoanType type, String principal, int months, String purpose,
                        String income, LocalDateTime applied) {
                BigDecimal amount = new BigDecimal(principal).setScale(2);
                BigDecimal rate = LoanService.product(type).rate();
                Loan loan = new Loan();
                loan.setLoanNumber("LN" + ids.digits(10));
                loan.setUser(user);
                loan.setType(type);
                loan.setPrincipal(amount);
                loan.setInterestRate(rate);
                loan.setTenureMonths(months);
                loan.setEmi(FinanceMath.emi(amount, rate, months));
                loan.setPurpose(purpose);
                loan.setMonthlyIncome(new BigDecimal(income).setScale(2));
                loan.setDisbursementAccount(account);
                loan.setAppliedAt(applied);
                return loanRepository.save(loan);
        }

        private void payee(User user, String name, String nickname, String accountNumber, String ifsc, String limit,
                        LocalDateTime created) {
                Beneficiary payee = new Beneficiary();
                payee.setUser(user);
                payee.setName(name);
                payee.setNickname(nickname);
                payee.setAccountNumber(accountNumber);
                payee.setIfscCode(ifsc);
                payee.setBankName(BankConstants.bankNameForIfsc(ifsc));
                payee.setTransferLimit(new BigDecimal(limit).setScale(2));
                payee.setCreatedAt(created);
                beneficiaryRepository.save(payee);
        }

        private void request(User user, Account account, ServiceRequest.RequestType type, String details,
                        ServiceRequest.RequestStatus status, String remarks, LocalDateTime created) {
                ServiceRequest request = new ServiceRequest();
                request.setTicketNumber("SR" + ids.digits(10));
                request.setUser(user);
                request.setAccount(account);
                request.setType(type);
                request.setDetails(details);
                request.setStatus(status);
                request.setRemarks(remarks);
                request.setCreatedAt(created);
                request.setUpdatedAt(status == ServiceRequest.RequestStatus.OPEN ? created : created.plusDays(1));
                requestRepository.save(request);
        }

        private void notification(User user, Notification.Category category, String title, String message,
                        LocalDateTime at, boolean read) {
                Notification notification = new Notification();
                notification.setUser(user);
                notification.setCategory(category);
                notification.setTitle(title);
                notification.setMessage(message);
                notification.setCreatedAt(at);
                notification.setRead(read);
                notificationRepository.save(notification);
        }

        // ---------- Ledger history ----------

        private void post(LocalDateTime at, Account account, Transaction.Direction direction,
                        Transaction.Channel channel, String amount,
                        String counterpartyName, String counterpartyAccount, String description) {
                post(at, account, direction, channel, amount, counterpartyName, counterpartyAccount, description,
                                ids.reference(channel.name()), false);
        }

        private void post(LocalDateTime at, Account account, Transaction.Direction direction,
                        Transaction.Channel channel, String amount,
                        String counterpartyName, String counterpartyAccount, String description, String reference,
                        boolean self) {
                if (at.isAfter(LocalDateTime.now()))
                        return; // Only history, never the future.
                postings.add(new Posting(at, postings.size(), account, direction, channel,
                                new BigDecimal(amount).setScale(2, RoundingMode.HALF_UP),
                                reference, counterpartyName, counterpartyAccount, description, self));
        }

        private void transfer(LocalDateTime at, Account from, Account to, Transaction.Channel channel, String amount,
                        String remarks,
                        User sender, User receiver, boolean self) {
                String reference = ids.reference(channel == Transaction.Channel.INTERNAL ? "TRF" : channel.name());
                post(at, from, Transaction.Direction.DEBIT, channel, amount, receiver.getFullName(),
                                channel == Transaction.Channel.UPI ? to.getUpiId() : to.getAccountNumber(), remarks,
                                reference, self);
                post(at, to, Transaction.Direction.CREDIT, channel, amount, sender.getFullName(),
                                channel == Transaction.Channel.UPI ? from.getUpiId() : from.getAccountNumber(), remarks,
                                reference, self);
        }

        /** Applies all postings in time order so every running balance is correct. */
        private void applyPostings() {
                postings.sort(Comparator.comparing(Posting::at).thenComparing(Posting::order));
                for (Posting p : postings) {
                        BigDecimal balance = p.account().getBalance();
                        if (p.direction() == Transaction.Direction.DEBIT) {
                                if (balance.compareTo(p.amount()) < 0)
                                        continue; // Skip a spend the account couldn't afford.
                                balance = balance.subtract(p.amount());
                        } else {
                                balance = balance.add(p.amount());
                        }
                        p.account().setBalance(balance);
                        Transaction txn = new Transaction();
                        txn.setAccount(p.account());
                        txn.setDirection(p.direction());
                        txn.setChannel(p.channel());
                        txn.setAmount(p.amount());
                        txn.setBalanceAfter(balance);
                        txn.setReferenceId(p.reference());
                        txn.setCounterpartyName(p.counterpartyName());
                        txn.setCounterpartyAccount(p.counterpartyAccount());
                        txn.setDescription(p.description());
                        txn.setSelfTransfer(p.self());
                        txn.setCreatedAt(p.at());
                        transactionRepository.save(txn);
                }
                postings.clear();
        }

        private LocalDateTime at(YearMonth month, int day, int hour, int minute) {
                return month.atDay(Math.min(day, month.lengthOfMonth())).atTime(LocalTime.of(hour, minute));
        }

        private String amount(int min, int max) {
                return String.valueOf(min + random.nextInt(max - min + 1));
        }

        private static String last4(Account account) {
                String number = account.getAccountNumber();
                return number.substring(number.length() - 4);
        }
}
