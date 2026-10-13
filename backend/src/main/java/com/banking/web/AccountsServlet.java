package com.banking.web;

import com.banking.core.BankAccount;
import com.banking.exception.BankingException;
import com.banking.jdbc.AccountDao;
import com.banking.service.AuditLogger;
import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;
import java.util.List;

/** Lists the customer's accounts. Product name, features and interest come from each subclass (polymorphism). */
public class AccountsServlet extends PortalServlet {

    private final transient AccountDao accountDao;

    public AccountsServlet(AccountDao accountDao, AuditLogger auditLogger) {
        super(auditLogger);
        this.accountDao = accountDao;
    }

    @Override
    protected String title() {
        return "Accounts";
    }

    @Override
    protected String render(HttpServletRequest request, PortalUser user) throws BankingException {
        List<BankAccount> accounts = accountDao.findByUserId(user.id());
        StringBuilder html = new StringBuilder("<h1>Welcome, ").append(Html.esc(user.fullName())).append("</h1>")
                .append("<p class=\"muted\">Customer ID ").append(Html.esc(user.customerId())).append("</p>")
                .append("<div class=\"card\"><h2>Your accounts</h2>");
        if (accounts.isEmpty()) {
            return html.append("<p class=\"muted\">You don't have any accounts yet.</p></div>").toString();
        }
        html.append("<table><tr><th>Account</th><th>Type</th><th>Status</th><th class=\"num\">Balance</th>")
                .append("<th class=\"num\">Interest this month</th><th></th></tr>");
        BigDecimal total = BigDecimal.ZERO;
        for (BankAccount account : accounts) {
            total = total.add(account.getBalance());
            html.append("<tr><td>").append(Html.esc(account.getAccountNumber())).append("</td>")
                    .append("<td>").append(Html.esc(account.productName()))
                    .append("<br><span class=\"muted\">").append(Html.esc(account.features())).append("</span></td>")
                    .append("<td>").append(Html.esc(account.getStatus())).append("</td>")
                    .append("<td class=\"num\">").append(Html.money(account.getBalance())).append("</td>")
                    .append("<td class=\"num\">").append(Html.money(account.monthlyInterest())).append("</td>")
                    .append("<td><a href=\"").append(request.getContextPath()).append("/portal/statement?accountId=")
                    .append(account.getId()).append("\">Mini statement</a></td></tr>");
        }
        html.append("<tr><th colspan=\"3\">Total</th><th class=\"num\">").append(Html.money(total)).append("</th><th></th><th></th></tr>");
        return html.append("</table></div>").toString();
    }
}
