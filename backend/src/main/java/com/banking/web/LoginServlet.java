package com.banking.web;

import com.banking.dto.AuthDtos.AuthResponse;
import com.banking.dto.AuthDtos.LoginRequest;
import com.banking.exception.ApiException;
import com.banking.jdbc.AuditEvent;
import com.banking.model.User;
import com.banking.service.AuditLogger;
import com.banking.service.AuthService;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;

/**
 * GET shows the sign-in form; POST checks the credentials and starts an {@link HttpSession}.
 * Credentials go through {@link AuthService}, so the same lockout and suspension rules as the React app apply.
 */
public class LoginServlet extends HttpServlet {

    private static final int SESSION_TIMEOUT_SECONDS = (int) Duration.ofMinutes(15).toSeconds();

    private final transient AuthService authService;
    private final transient AuditLogger auditLogger;

    public LoginServlet(AuthService authService, AuditLogger auditLogger) {
        this.authService = authService;
        this.auditLogger = auditLogger;
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (PortalServlet.currentUser(request) != null) {
            response.sendRedirect(request.getContextPath() + "/portal/accounts");
            return;
        }
        String notice = request.getParameter("loggedOut") != null ? "You have been logged out." : null;
        showForm(request, response, HttpServletResponse.SC_OK, "", notice, null);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String username = trimToEmpty(request.getParameter("username"));
        String password = request.getParameter("password") == null ? "" : request.getParameter("password");
        if (username.isEmpty() || password.isEmpty()) {
            showForm(request, response, HttpServletResponse.SC_BAD_REQUEST, username, null, "Enter your email or customer ID and your password.");
            return;
        }

        AuthResponse auth;
        try {
            auth = authService.login(new LoginRequest(username, password));
        } catch (ApiException e) {
            showForm(request, response, e.getStatus().value(), username, null, e.getMessage());
            return;
        }
        if (auth.user().role() != User.Role.ROLE_CUSTOMER) {
            showForm(request, response, HttpServletResponse.SC_FORBIDDEN, username, null,
                    "This portal is for customers. Please use the admin console.");
            return;
        }

        // A fresh session on every login prevents session fixation.
        HttpSession old = request.getSession(false);
        if (old != null) old.invalidate();
        HttpSession session = request.getSession(true);
        session.setMaxInactiveInterval(SESSION_TIMEOUT_SECONDS);
        PortalUser user = new PortalUser(auth.user().id(), auth.user().customerId(), auth.user().fullName());
        session.setAttribute(PortalServlet.SESSION_USER, user);
        auditLogger.record(new AuditEvent(user.id(), "LOGIN", "Servlet portal", request.getRemoteAddr(), LocalDateTime.now()));
        response.sendRedirect(request.getContextPath() + "/portal/accounts");
    }

    private static void showForm(HttpServletRequest request, HttpServletResponse response, int status,
                                 String username, String notice, String error) throws IOException {
        String body = "<div class=\"card\" style=\"max-width:420px;margin:40px auto\"><h1>Sign in</h1>"
                + (error == null ? "" : "<div class=\"error\">" + Html.esc(error) + "</div>")
                + (notice == null ? "" : "<p class=\"muted\">" + Html.esc(notice) + "</p>")
                + "<form method=\"post\" action=\"" + request.getContextPath() + "/portal/login\">"
                + "<label for=\"username\">Email or customer ID</label>"
                + "<input id=\"username\" name=\"username\" autocomplete=\"username\" required value=\"" + Html.esc(username) + "\">"
                + "<label for=\"password\">Password</label>"
                + "<input id=\"password\" name=\"password\" type=\"password\" autocomplete=\"current-password\" required>"
                + "<button type=\"submit\">Sign in</button></form>"
                + "<p class=\"muted\">Demo: priya.v@example.com / Customer@123</p></div>";
        Html.send(request, response, status, "Sign in", null, body);
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
