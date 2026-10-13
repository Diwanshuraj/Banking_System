package com.banking.web;

import com.banking.exception.BankingException;
import com.banking.jdbc.TransactionRecord;
import com.banking.model.Transaction;
import com.banking.service.AuditLogger;
import com.banking.service.PortfolioReportService;
import com.banking.service.PortfolioReportService.AccountSummary;
import com.banking.service.PortfolioReportService.Report;
import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;
import java.util.Map;

/** 30-day portfolio report, computed in parallel by {@link PortfolioReportService}. */
public class ReportServlet extends PortalServlet {

    private final transient PortfolioReportService reportService;

    public ReportServlet(PortfolioReportService reportService, AuditLogger auditLogger) {
        super(auditLogger);
        this.reportService = reportService;
    }

    @Override
    protected String title() {
        return "30-day report";
    }

    @Override
    protected String render(HttpServletRequest request, PortalUser user) throws BankingException {
        Report report = reportService.build(user.id());
        StringBuilder html = new StringBuilder("<h1>Last ").append(PortfolioReportService.REPORT_DAYS).append(" days</h1>");

        html.append("<div class=\"card\"><h2>By account</h2><table><tr><th>Account</th><th class=\"num\">Money in</th>")
                .append("<th class=\"num\">Money out</th><th class=\"num\">Balance</th><th class=\"num\">Interest this month</th></tr>");
        for (AccountSummary summary : report.accounts()) {
            html.append("<tr><td>").append(Html.esc(summary.account().productName())).append(" · ")
                    .append(Html.esc(summary.account().last4())).append("</td>")
                    .append("<td class=\"num credit\">").append(Html.money(summary.moneyIn())).append("</td>")
                    .append("<td class=\"num debit\">").append(Html.money(summary.moneyOut())).append("</td>")
                    .append("<td class=\"num\">").append(Html.money(summary.account().getBalance())).append("</td>")
                    .append("<td class=\"num\">").append(Html.money(summary.account().monthlyInterest())).append("</td></tr>");
        }
        html.append("<tr><th>Total</th><th></th><th></th><th class=\"num\">").append(Html.money(report.totalBalance()))
                .append("</th><th class=\"num\">").append(Html.money(report.totalMonthlyInterest())).append("</th></tr></table></div>");

        html.append("<div class=\"card\"><h2>Where your money went</h2>");
        if (report.spendByChannel().isEmpty()) {
            html.append("<p class=\"muted\">No spending in this period.</p>");
        } else {
            html.append("<table><tr><th>Channel</th><th class=\"num\">Spent</th></tr>");
            for (Map.Entry<Transaction.Channel, BigDecimal> entry : report.spendByChannel().entrySet()) {
                html.append("<tr><td>").append(Html.esc(entry.getKey())).append("</td><td class=\"num\">")
                        .append(Html.money(entry.getValue())).append("</td></tr>");
            }
            html.append("</table>");
        }
        html.append("</div>");

        html.append("<div class=\"card\"><h2>Largest transactions</h2>");
        if (report.largestTransactions().isEmpty()) {
            html.append("<p class=\"muted\">No transactions in this period.</p>");
        } else {
            html.append("<table><tr><th>Date</th><th>Description</th><th class=\"num\">Amount</th></tr>");
            for (TransactionRecord t : report.largestTransactions()) {
                html.append("<tr><td>").append(Html.dateTime(t.createdAt())).append("</td><td>").append(Html.esc(t.description()))
                        .append("</td><td class=\"num ").append(t.isCredit() ? "credit\">+" : "debit\">−")
                        .append(Html.money(t.amount())).append("</td></tr>");
            }
            html.append("</table>");
        }
        html.append("</div>");

        html.append("<p class=\"muted\">Built in ").append(report.elapsedMillis()).append(" ms on ")
                .append(report.workerThreads().size()).append(" worker thread(s): ")
                .append(Html.esc(String.join(", ", report.workerThreads()))).append("</p>");
        return html.toString();
    }
}
