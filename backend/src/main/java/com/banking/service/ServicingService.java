package com.banking.service;

import com.banking.dto.AdminDtos.ServiceRequestUpdate;
import com.banking.dto.BankingDtos.*;
import com.banking.exception.ApiException;
import com.banking.model.*;
import com.banking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

/** Debit cards, bill payments and service requests. */
@Service
@RequiredArgsConstructor
public class ServicingService {

    public static final List<BillerCategory> BILLERS = List.of(
            new BillerCategory(BillPayment.BillCategory.ELECTRICITY, "Electricity", "Consumer number",
                    List.of("BSES Rajdhani Power", "Tata Power Delhi", "Adani Electricity Mumbai", "BESCOM Bengaluru", "MSEDCL Maharashtra", "TNEB Tamil Nadu")),
            new BillerCategory(BillPayment.BillCategory.MOBILE, "Mobile recharge", "Mobile number",
                    List.of("Jio Prepaid", "Airtel Prepaid", "Vi Prepaid", "BSNL Prepaid", "Airtel Postpaid", "Jio Postpaid")),
            new BillerCategory(BillPayment.BillCategory.DTH, "DTH", "Subscriber ID",
                    List.of("Tata Play", "Airtel Digital TV", "Dish TV", "Sun Direct")),
            new BillerCategory(BillPayment.BillCategory.WATER, "Water", "Consumer number",
                    List.of("Delhi Jal Board", "BWSSB Bengaluru", "MCGM Water Mumbai")),
            new BillerCategory(BillPayment.BillCategory.GAS, "Piped gas", "Customer ID",
                    List.of("Indraprastha Gas", "Mahanagar Gas", "Adani Total Gas")),
            new BillerCategory(BillPayment.BillCategory.BROADBAND, "Broadband", "Account number",
                    List.of("JioFiber", "Airtel Xstream Fiber", "ACT Fibernet", "BSNL Bharat Fiber")),
            new BillerCategory(BillPayment.BillCategory.FASTAG, "FASTag", "Vehicle number",
                    List.of("BNB FASTag", "NHAI FASTag", "Paytm FASTag")),
            new BillerCategory(BillPayment.BillCategory.INSURANCE, "Insurance premium", "Policy number",
                    List.of("LIC of India", "HDFC Life", "ICICI Prudential Life", "Star Health")),
            new BillerCategory(BillPayment.BillCategory.CREDIT_CARD, "Credit card", "Card number (last 4 digits)",
                    List.of("BNB Credit Card", "HDFC Bank Credit Card", "ICICI Bank Credit Card", "Axis Bank Credit Card")));

    private final DebitCardRepository cardRepository;
    private final BillPaymentRepository billRepository;
    private final ServiceRequestRepository requestRepository;
    private final AccountRepository accountRepository;
    private final LedgerService ledger;
    private final AuthService authService;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final IdGenerator ids;
    private final DtoMapper mapper;

    // ---------- Cards ----------

    @Transactional(readOnly = true)
    public List<CardDto> cards(Long userId) {
        return cardRepository.findByAccountUserIdOrderByIdAsc(userId).stream().map(mapper::card).toList();
    }

    private DebitCard ownedCard(Long userId, Long cardId) {
        return cardRepository.findByIdAndAccountUserId(cardId, userId).orElseThrow(() -> ApiException.notFound("Card not found"));
    }

    @Transactional
    public CardDto updateControls(Long userId, Long cardId, CardControlsRequest request) {
        DebitCard card = ownedCard(userId, cardId);
        if (card.getStatus() == DebitCard.CardStatus.HOTLISTED) throw ApiException.badRequest("This card was reported lost and can't be changed.");
        for (BigDecimal limit : List.of(request.atmLimit(), request.posLimit(), request.onlineLimit())) {
            if (limit.compareTo(card.getMaxLimit()) > 0) {
                throw ApiException.badRequest("Limits on this card can be at most ₹" + card.getMaxLimit().toPlainString() + ".");
            }
        }
        boolean internationalTurnedOn = request.internationalEnabled() && !card.isInternationalEnabled();
        card.setOnlineEnabled(request.onlineEnabled());
        card.setInternationalEnabled(request.internationalEnabled());
        card.setContactlessEnabled(request.contactlessEnabled());
        card.setAtmEnabled(request.atmEnabled());
        card.setAtmLimit(request.atmLimit().setScale(2, java.math.RoundingMode.DOWN));
        card.setPosLimit(request.posLimit().setScale(2, java.math.RoundingMode.DOWN));
        card.setOnlineLimit(request.onlineLimit().setScale(2, java.math.RoundingMode.DOWN));
        notifications.notify(card.getAccount().getUser(), Notification.Category.SECURITY, "Card settings updated",
                "Usage controls for your debit card ending " + card.getLast4() + " were changed"
                        + (internationalTurnedOn ? ", including enabling international use" : "") + ".");
        return mapper.card(card);
    }

    @Transactional
    public CardDto setCardStatus(Long userId, Long cardId, DebitCard.CardStatus target) {
        DebitCard card = ownedCard(userId, cardId);
        if (card.getStatus() == DebitCard.CardStatus.HOTLISTED) throw ApiException.badRequest("This card was reported lost and is permanently blocked.");
        if (card.getStatus() == target) return mapper.card(card);
        card.setStatus(target);
        User user = card.getAccount().getUser();
        switch (target) {
            case BLOCKED -> notifications.notify(user, Notification.Category.SECURITY, "Card temporarily blocked",
                    "Your debit card ending " + card.getLast4() + " is blocked. You can unblock it any time.");
            case ACTIVE -> notifications.notify(user, Notification.Category.SECURITY, "Card unblocked",
                    "Your debit card ending " + card.getLast4() + " is active again.");
            case HOTLISTED -> {
                ServiceRequest reissue = newRequest(user, card.getAccount(), ServiceRequest.RequestType.DEBIT_CARD_REISSUE,
                        "Automatic replacement for card ending " + card.getLast4() + " reported lost/stolen.");
                notifications.notify(user, Notification.Category.SECURITY, "Card reported lost",
                        "Card ending " + card.getLast4() + " is permanently blocked. Replacement request " + reissue.getTicketNumber() + " was raised.");
            }
        }
        return mapper.card(card);
    }

    // ---------- Bills ----------

    @Transactional(readOnly = true)
    public List<BillPaymentDto> billHistory(Long userId) {
        return billRepository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(mapper::billPayment).toList();
    }

    @Transactional
    public BillPaymentDto payBill(Long userId, BillPaymentRequest request) {
        settings.requireNotInMaintenance();
        User user = authService.loadUser(userId);
        authService.requirePin(user, request.pin());
        BillerCategory category = BILLERS.stream().filter(c -> c.category() == request.category()).findFirst().orElseThrow();
        if (!category.billers().contains(request.billerName())) throw ApiException.badRequest("Choose a biller from the list.");
        Account account = accountRepository.findById(request.accountId())
                .filter(a -> a.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Account not found"));

        String reference = "BBPS" + ids.digits(12);
        String consumer = request.consumerNumber().trim().toUpperCase(Locale.ROOT);
        Account locked = ledger.lockOne(account.getId());
        ledger.debit(locked, request.amount(), new LedgerService.Entry(Transaction.Channel.BILL_PAYMENT, reference,
                request.billerName(), consumer, category.label() + " payment", false));

        BillPayment payment = new BillPayment();
        payment.setReferenceId(reference);
        payment.setUser(user);
        payment.setAccount(locked);
        payment.setCategory(request.category());
        payment.setBillerName(request.billerName());
        payment.setConsumerNumber(consumer);
        payment.setAmount(LedgerService.normalize(request.amount()));
        billRepository.save(payment);

        notifications.notify(user, Notification.Category.TRANSACTION, category.label() + " paid",
                "₹" + payment.getAmount().toPlainString() + " paid to " + request.billerName() + " for " + consumer + ". Ref " + reference + ".");
        return mapper.billPayment(payment);
    }

    // ---------- Service requests ----------

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> requests(Long userId) {
        return requestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(mapper::serviceRequest).toList();
    }

    @Transactional
    public ServiceRequestDto createRequest(Long userId, ServiceRequestCreate request) {
        User user = authService.loadUser(userId);
        Account account = null;
        if (request.accountId() != null) {
            account = accountRepository.findById(request.accountId())
                    .filter(a -> a.getUser().getId().equals(userId))
                    .orElseThrow(() -> ApiException.notFound("Account not found"));
        }
        ServiceRequest created = newRequest(user, account, request.type(), request.details().trim());
        notifications.notify(user, Notification.Category.GENERAL, "Service request raised",
                "Ticket " + created.getTicketNumber() + " was created. We'll update you as it progresses.");
        return mapper.serviceRequest(created);
    }

    private ServiceRequest newRequest(User user, Account account, ServiceRequest.RequestType type, String details) {
        ServiceRequest request = new ServiceRequest();
        request.setTicketNumber(ids.unique(() -> "SR" + ids.digits(10), requestRepository::existsByTicketNumber));
        request.setUser(user);
        request.setAccount(account);
        request.setType(type);
        request.setDetails(details);
        request.setStatus(ServiceRequest.RequestStatus.OPEN);
        return requestRepository.save(request);
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestDto> adminRequests(ServiceRequest.RequestStatus status) {
        List<ServiceRequest> requests = status == null ? requestRepository.findAllByOrderByCreatedAtDesc() : requestRepository.findByStatusOrderByCreatedAtDesc(status);
        return requests.stream().map(mapper::serviceRequest).toList();
    }

    @Transactional
    public ServiceRequestDto updateRequest(Long id, ServiceRequestUpdate update) {
        ServiceRequest request = requestRepository.findById(id).orElseThrow(() -> ApiException.notFound("Request not found"));
        String remarks = update.remarks() == null || update.remarks().isBlank() ? null : update.remarks().trim();
        if (update.status() == ServiceRequest.RequestStatus.REJECTED && remarks == null) {
            throw ApiException.badRequest("Add a reason when rejecting a request.");
        }
        request.setStatus(update.status());
        if (remarks != null) request.setRemarks(remarks);
        notifications.notify(request.getUser(), Notification.Category.GENERAL, "Service request updated",
                "Ticket " + request.getTicketNumber() + " is now " + update.status().name().toLowerCase(Locale.ROOT).replace('_', ' ')
                        + (remarks != null ? ": " + remarks : "."));
        return mapper.serviceRequest(request);
    }
}
