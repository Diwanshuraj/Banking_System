package com.banking.web;

import com.banking.exception.AccountNotFoundException;
import com.banking.exception.BankingException;
import com.banking.jdbc.AuditEvent;
import com.banking.service.AuditLogger;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.time.LocalDateTime;

/**
 * Base class for the signed-in portal pages (template method): {@link #doGet} handles the session,
 * errors, auditing and the page frame, and each subclass only renders its own content.
 * {@link PortalAuthFilter} guarantees a signed-in user before any of these servlets run.
 */
@Slf4j
public abstract class PortalServlet extends HttpServlet {

    public static final String SESSION_USER = "portalUser";

    private final transient AuditLogger auditLogger;

    protected PortalServlet(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

    protected abstract String title();

    /** Returns the page body; throw a {@link BankingException} to show an error page instead. */
    protected abstract String render(HttpServletRequest request, PortalUser user) throws BankingException;

    @Override
    protected final void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        PortalUser user = currentUser(request);
        if (user == null) {
            response.sendRedirect(request.getContextPath() + "/portal/login");
            return;
        }
        try {
            String body = render(request, user);
            auditLogger.record(new AuditEvent(user.id(), "VIEW", pathWithQuery(request), request.getRemoteAddr(), LocalDateTime.now()));
            Html.send(request, response, HttpServletResponse.SC_OK, title(), user, body);
        } catch (IllegalArgumentException e) {
            Html.send(request, response, HttpServletResponse.SC_BAD_REQUEST, "Bad request", user, errorBody(request, e.getMessage()));
        } catch (AccountNotFoundException e) {
            Html.send(request, response, HttpServletResponse.SC_NOT_FOUND, "Not found", user, errorBody(request, e.getMessage()));
        } catch (BankingException e) {
            log.error("Portal page {} failed", request.getServletPath(), e);
            Html.send(request, response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error", user,
                    errorBody(request, "We couldn't load this page. Please try again."));
        }
    }

    static PortalUser currentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (PortalUser) session.getAttribute(SESSION_USER);
    }

    protected static long requiredLong(HttpServletRequest request, String name) {
        String value = request.getParameter(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing parameter: " + name);
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Parameter " + name + " must be a number.");
        }
    }

    private static String errorBody(HttpServletRequest request, String message) {
        return "<div class=\"card\"><div class=\"error\">" + Html.esc(message) + "</div>"
                + "<a href=\"" + request.getContextPath() + "/portal/accounts\">Back to accounts</a></div>";
    }

    private static String pathWithQuery(HttpServletRequest request) {
        String query = request.getQueryString();
        return request.getServletPath() + (query == null ? "" : "?" + query);
    }
}
