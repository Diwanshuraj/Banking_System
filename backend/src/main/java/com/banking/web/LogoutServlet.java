package com.banking.web;

import com.banking.jdbc.AuditEvent;
import com.banking.service.AuditLogger;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.time.LocalDateTime;

/** POST only, so a link or image on another site can't log the customer out. */
public class LogoutServlet extends HttpServlet {

    private final transient AuditLogger auditLogger;

    public LogoutServlet(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        PortalUser user = PortalServlet.currentUser(request);
        if (user != null) {
            auditLogger.record(new AuditEvent(user.id(), "LOGOUT", "Servlet portal", request.getRemoteAddr(), LocalDateTime.now()));
        }
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        response.sendRedirect(request.getContextPath() + "/portal/login?loggedOut");
    }
}
