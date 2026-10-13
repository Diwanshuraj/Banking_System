package com.banking.web;

import com.banking.jdbc.AccountDao;
import com.banking.jdbc.AuditLogDao;
import com.banking.jdbc.TransactionDao;
import com.banking.service.AuditLogger;
import com.banking.service.AuthService;
import com.banking.service.PortfolioReportService;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the servlet portal with the embedded Tomcat, the same way a {@code web.xml} would:
 * servlet and URL mappings, the authentication filter, and the lifecycle listener.
 */
@Configuration
public class PortalWebConfig {

    @Bean
    public ServletRegistrationBean<LoginServlet> loginServlet(AuthService authService, AuditLogger auditLogger) {
        return new ServletRegistrationBean<>(new LoginServlet(authService, auditLogger), "/portal/login");
    }

    @Bean
    public ServletRegistrationBean<LogoutServlet> logoutServlet(AuditLogger auditLogger) {
        return new ServletRegistrationBean<>(new LogoutServlet(auditLogger), "/portal/logout");
    }

    @Bean
    public ServletRegistrationBean<AccountsServlet> accountsServlet(AccountDao accountDao, AuditLogger auditLogger) {
        return new ServletRegistrationBean<>(new AccountsServlet(accountDao, auditLogger), "/portal", "/portal/accounts");
    }

    @Bean
    public ServletRegistrationBean<StatementServlet> statementServlet(AccountDao accountDao, TransactionDao transactionDao,
                                                                      AuditLogger auditLogger) {
        return new ServletRegistrationBean<>(new StatementServlet(accountDao, transactionDao, auditLogger), "/portal/statement");
    }

    @Bean
    public ServletRegistrationBean<ReportServlet> reportServlet(PortfolioReportService reportService, AuditLogger auditLogger) {
        return new ServletRegistrationBean<>(new ReportServlet(reportService, auditLogger), "/portal/report");
    }

    @Bean
    public ServletRegistrationBean<ActivityServlet> activityServlet(AuditLogger auditLogger, AuditLogDao auditLogDao) {
        return new ServletRegistrationBean<>(new ActivityServlet(auditLogger, auditLogDao), "/portal/activity");
    }

    @Bean
    public FilterRegistrationBean<PortalAuthFilter> portalAuthFilter() {
        FilterRegistrationBean<PortalAuthFilter> registration = new FilterRegistrationBean<>(new PortalAuthFilter());
        registration.addUrlPatterns("/portal", "/portal/*");
        return registration;
    }

    @Bean
    public ServletListenerRegistrationBean<PortalLifecycleListener> portalLifecycleListener() {
        return new ServletListenerRegistrationBean<>(new PortalLifecycleListener());
    }
}
