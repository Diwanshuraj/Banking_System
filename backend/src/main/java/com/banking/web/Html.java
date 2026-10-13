package com.banking.web;

import com.banking.service.BankConstants;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

/** Renders the portal's HTML pages. All dynamic text must go through {@link #esc}. */
final class Html {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.ENGLISH);

    private static final String STYLE = """
            :root { --bg:#f6f7f9; --card:#fff; --text:#1d2433; --muted:#5d6678; --line:#e3e6eb; --brand:#1f4e9c; --credit:#11793b; --debit:#b42318; }
            @media (prefers-color-scheme: dark) { :root { --bg:#12151b; --card:#1b1f27; --text:#e8eaef; --muted:#9aa3b2; --line:#2c323d; --brand:#7aa7f0; --credit:#5fd08b; --debit:#f08a80; } }
            * { box-sizing:border-box; }
            body { margin:0; font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
            header { background:var(--card); border-bottom:1px solid var(--line); padding:12px 16px; display:flex; flex-wrap:wrap; gap:12px 24px; align-items:center; }
            header strong { color:var(--brand); margin-right:auto; }
            nav a { color:var(--text); margin-right:16px; text-decoration:none; }
            nav a:hover { color:var(--brand); }
            main { max-width:1000px; margin:24px auto; padding:0 16px; }
            .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 20px; margin-bottom:20px; overflow-x:auto; }
            h1 { font-size:22px; margin:0 0 16px; } h2 { font-size:17px; margin:0 0 12px; }
            table { width:100%; border-collapse:collapse; } th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); white-space:nowrap; }
            th { color:var(--muted); font-weight:600; font-size:13px; } td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
            .muted { color:var(--muted); } .credit { color:var(--credit); } .debit { color:var(--debit); }
            .error { background:color-mix(in srgb, var(--debit) 12%, transparent); color:var(--debit); padding:10px 12px; border-radius:8px; margin-bottom:16px; }
            label { display:block; margin:12px 0 4px; font-weight:600; }
            input { width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--text); font:inherit; }
            button { margin-top:16px; padding:9px 16px; border:0; border-radius:8px; background:var(--brand); color:#fff; font:inherit; cursor:pointer; }
            button.link { margin:0; padding:0; background:none; color:var(--text); }
            footer { text-align:center; color:var(--muted); font-size:13px; margin:32px 0; }
            """;

    private Html() {
    }

    static String esc(Object value) {
        if (value == null) return "";
        String s = value.toString();
        StringBuilder out = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            switch (c) {
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '&' -> out.append("&amp;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    static String money(BigDecimal amount) {
        return esc(NumberFormat.getCurrencyInstance(new Locale("en", "IN")).format(amount));
    }

    static String dateTime(LocalDateTime value) {
        return esc(DATE_TIME.format(value));
    }

    static void send(HttpServletRequest request, HttpServletResponse response, int status, String title,
                     PortalUser user, String body) throws IOException {
        response.setStatus(status);
        response.setContentType("text/html");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        String context = request.getContextPath();
        PrintWriter out = response.getWriter();
        out.println("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
        out.println("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
        out.println("<title>" + esc(title) + " · " + esc(BankConstants.BANK_NAME) + "</title><style>" + STYLE + "</style></head><body>");
        out.println("<header><strong>" + esc(BankConstants.BANK_NAME) + " · Servlet portal</strong>");
        if (user != null) {
            out.println("<nav><a href=\"" + context + "/portal/accounts\">Accounts</a><a href=\"" + context + "/portal/report\">30-day report</a>"
                    + "<a href=\"" + context + "/portal/activity\">Activity</a></nav>");
            out.println("<form method=\"post\" action=\"" + context + "/portal/logout\"><span class=\"muted\">" + esc(user.fullName())
                    + " · </span><button class=\"link\" type=\"submit\">Log out</button></form>");
        }
        out.println("</header><main>" + body + "</main>");
        Object sessions = request.getServletContext().getAttribute(PortalLifecycleListener.ACTIVE_SESSIONS);
        out.println("<footer>Served by plain Java servlets over JDBC"
                + (sessions instanceof AtomicInteger count ? " · Active portal sessions: " + count.get() : "") + "</footer>");
        out.println("</body></html>");
    }
}
