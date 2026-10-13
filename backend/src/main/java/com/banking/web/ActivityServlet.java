package com.banking.web;

import com.banking.exception.BankingException;
import com.banking.jdbc.AuditEvent;
import com.banking.jdbc.AuditLogDao;
import com.banking.service.AuditLogger;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

/** The customer's recent portal activity, read back from the JDBC audit table. */
public class ActivityServlet extends PortalServlet {

    private final transient AuditLogger auditLogger;
    private final transient AuditLogDao auditLogDao;

    public ActivityServlet(AuditLogger auditLogger, AuditLogDao auditLogDao) {
        super(auditLogger);
        this.auditLogger = auditLogger;
        this.auditLogDao = auditLogDao;
    }

    @Override
    protected String title() {
        return "Activity";
    }

    @Override
    protected String render(HttpServletRequest request, PortalUser user) throws BankingException {
        try {
            auditLogger.flush(2_000); // Let the background writer catch up so the latest clicks show.
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        List<AuditEvent> events = auditLogDao.findRecentByUser(user.id(), 30);
        StringBuilder html = new StringBuilder("<h1>Recent activity</h1><div class=\"card\">");
        if (events.isEmpty()) {
            return html.append("<p class=\"muted\">No activity yet.</p></div>").toString();
        }
        html.append("<table><tr><th>When</th><th>Action</th><th>Detail</th><th>IP address</th></tr>");
        for (AuditEvent event : events) {
            html.append("<tr><td>").append(Html.dateTime(event.createdAt())).append("</td>")
                    .append("<td>").append(Html.esc(event.action())).append("</td>")
                    .append("<td>").append(Html.esc(event.detail())).append("</td>")
                    .append("<td class=\"muted\">").append(Html.esc(event.ipAddress())).append("</td></tr>");
        }
        return html.append("</table></div>").toString();
    }
}
