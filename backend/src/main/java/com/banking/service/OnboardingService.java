package com.banking.service;

import com.banking.exception.ApiException;
import com.banking.model.Account;
import com.banking.model.DebitCard;
import com.banking.model.Notification;
import com.banking.model.User;
import com.banking.repository.AccountRepository;
import com.banking.repository.DebitCardRepository;
import com.banking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Creates customers, accounts, UPI IDs and debit cards. Used by self-registration, the admin console and the seeder. */
@Service
@RequiredArgsConstructor
public class OnboardingService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final DebitCardRepository cardRepository;
    private final PasswordEncoder passwordEncoder;
    private final IdGenerator ids;
    private final SettingsService settings;
    private final NotificationService notifications;

    public record NewCustomer(String fullName, String email, String phone, String password, String panNumber,
                              String aadhaarNumber, LocalDate dateOfBirth, String address) {
    }

    public User createCustomer(NewCustomer data) {
        String email = data.email().trim().toLowerCase(Locale.ROOT);
        String pan = data.panNumber().trim().toUpperCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account already exists with this email. Try logging in instead.");
        }
        if (userRepository.existsByPanNumber(pan)) {
            throw ApiException.conflict("This PAN is already registered with another customer.");
        }
        if (data.dateOfBirth().plusYears(18).isAfter(LocalDate.now())) {
            throw ApiException.badRequest("You must be at least 18 years old to open an account online.");
        }

        User user = new User();
        user.setCustomerId(ids.unique(ids::customerId, userRepository::existsByCustomerId));
        user.setFullName(data.fullName().trim());
        user.setEmail(email);
        user.setPhone(normalizePhone(data.phone()));
        user.setPasswordHash(passwordEncoder.encode(data.password()));
        user.setPanNumber(pan);
        user.setAadhaarNumber(data.aadhaarNumber().trim());
        user.setDateOfBirth(data.dateOfBirth());
        user.setAddress(data.address().trim());
        user.setRole(User.Role.ROLE_CUSTOMER);
        user.setStatus(User.UserStatus.ACTIVE);
        userRepository.save(user);

        notifications.notify(user, Notification.Category.ACCOUNT, "Welcome to " + BankConstants.BANK_NAME,
                "Your customer ID is " + user.getCustomerId() + ". Set a 6-digit transaction PIN under Profile & security before making payments.");
        return user;
    }

    /** Opens an account with a debit card. The customer's first account also gets their UPI ID. */
    public Account openAccount(User user, Account.AccountType type, String nomineeName) {
        boolean first = accountRepository.findByUserIdOrderByOpenedAtAsc(user.getId()).isEmpty();

        Account account = new Account();
        account.setUser(user);
        account.setAccountNumber(ids.unique(ids::accountNumber, accountRepository::existsByAccountNumber));
        account.setIfscCode(BankConstants.HOME_IFSC);
        account.setBranchName(BankConstants.HOME_BRANCH);
        account.setAccountType(type);
        account.setBalance(BigDecimal.ZERO.setScale(2));
        account.setInterestRate(type == Account.AccountType.CURRENT
                ? BigDecimal.ZERO.setScale(2)
                : settings.amount(SettingsService.Key.SAVINGS_INTEREST_RATE));
        account.setNomineeName(nomineeName == null || nomineeName.isBlank() ? null : nomineeName.trim());
        if (first) account.setUpiId(uniqueUpiId(user));
        accountRepository.save(account);

        DebitCard card = issueCard(account);
        notifications.notify(user, Notification.Category.ACCOUNT, "New " + type.name().toLowerCase(Locale.ROOT) + " account opened",
                "Account ending " + LedgerService.last4(account) + " is active. Your debit card ending " + card.getLast4()
                        + " will reach your registered address within 7 working days.");
        return account;
    }

    public DebitCard issueCard(Account account) {
        boolean premium = account.getAccountType() == Account.AccountType.CURRENT;
        DebitCard card = new DebitCard();
        card.setAccount(account);
        card.setNetwork(premium ? DebitCard.Network.VISA : DebitCard.Network.RUPAY);
        card.setVariant(premium ? "Platinum Business" : "Classic");
        card.setFirst4(premium ? "4214" : "6070");
        card.setLast4(ids.digits(4));
        card.setExpiry(LocalDate.now().plusYears(5).format(DateTimeFormatter.ofPattern("MM/yy")));
        BigDecimal max = premium ? new BigDecimal("500000.00") : new BigDecimal("200000.00");
        card.setMaxLimit(max);
        card.setAtmLimit(new BigDecimal("40000.00"));
        card.setPosLimit(new BigDecimal("100000.00"));
        card.setOnlineLimit(new BigDecimal("100000.00"));
        return cardRepository.save(card);
    }

    private String uniqueUpiId(User user) {
        String base = user.getFullName().toLowerCase(Locale.ROOT).replaceAll("[^a-z ]", "").trim().split("\\s+")[0];
        if (base.isBlank()) base = "user";
        String candidate = base + BankConstants.UPI_HANDLE;
        if (!accountRepository.existsByUpiId(candidate)) return candidate;
        String phoneDigits = user.getPhone() == null ? "" : user.getPhone().replaceAll("\\D", "");
        if (phoneDigits.length() >= 4) {
            candidate = base + "." + phoneDigits.substring(phoneDigits.length() - 4) + BankConstants.UPI_HANDLE;
            if (!accountRepository.existsByUpiId(candidate)) return candidate;
        }
        final String prefix = base;
        return ids.unique(() -> prefix + ids.digits(4) + BankConstants.UPI_HANDLE, accountRepository::existsByUpiId);
    }

    /** "+91 98123-45678" style. */
    public static String normalizePhone(String phone) {
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) digits = digits.substring(2);
        if (digits.length() != 10) return phone.trim();
        return "+91 " + digits.substring(0, 5) + "-" + digits.substring(5);
    }
}
