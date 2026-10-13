package com.banking.web;

import com.banking.core.BankAccount;
import com.banking.exception.AccountNotFoundException;
import com.banking.exception.BankingException;
import com.banking.jdbc.AccountDao;
import com.banking.jdbc.TransactionDao;
import com.banking.jdbc.TransactionRecord;
import com.banking.service.AuditLogger;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

/** Mini statement: the latest entries on one of the customer's own accounts ({@code ?accountId=}). */
public class StatementServlet extends PortalServlet {

    private static final int ENTRIES = 25;

    private final transient AccountDao accountDao;
    private final transient TransactionDao transactionDao;

    public StatementServlet(AccountDao accountDao, TransactionDao transactionDao, AuditLogger auditLogger) {
        super(auditLogger);
        this.accountDao = accountDao;
        this.transactionDao = transactionDao;
    }

    @Override
    protected String title() {
        return "Mini statement";
    }

    @Override
    protected String render(HttpServletRequest request, PortalUser user) throws BankingException {
        long accountId = requiredLong(request, "accountId");
        BankAccount account = accountDao.findByIdForUser(accountId, user.id())
                .orElseThrow(() -> new AccountNotFoundException(accountId));
        List<TransactionRecord> entries = transactionDao.findRecent(account.getId(), ENTRIES);

        StringBuilder html = new StringBuilder("<h1>Mini statement</h1><div class=\"card\"><h2>")
                .append(Html.esc(account.productName())).append(" · ").append(Html.esc(account.getAccountNumber()))
                .append("</h2><p>Available balance <strong>").append(Html.money(account.getBalance())).append("</strong></p>");
        if (entries.isEmpty()) {
            return html.append("<p class=\"muted\">No transactions yet.</p></div>").toString();
        }
        html.append("<table><tr><th>Date</th><th>Description</th><th>Channel</th><th>Reference</th>")
                .append("<th class=\"num\">Amount</th><th class=\"num\">Balance</th></tr>");
        for (TransactionRecord t : entries) {
            html.append("<tr><td>").append(Html.dateTime(t.createdAt())).append("</td>")
                    .append("<td>").append(Html.esc(t.description()))
                    .append(t.counterpartyName() == null ? "" : "<br><span class=\"muted\">" + Html.esc(t.counterpartyName()) + "</span>")
                    .append("</td><td>").append(Html.esc(t.channel())).append("</td>")
                    .append("<td class=\"muted\">").append(Html.esc(t.referenceId())).append("</td>")
                    .append("<td class=\"num ").append(t.isCredit() ? "credit\">+" : "debit\">−").append(Html.money(t.amount())).append("</td>")
                    .append("<td class=\"num\">").append(Html.money(t.balanceAfter())).append("</td></tr>");
        }
        return html.append("</table></div>").toString();
    }
}
