package com.banking.web;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Publishes a live session counter in the {@code ServletContext}. Sessions are created and destroyed
 * on different request threads, so the counter is an {@link AtomicInteger}.
 */
@Slf4j
public class PortalLifecycleListener implements ServletContextListener, HttpSessionListener {

    public static final String ACTIVE_SESSIONS = "portal.activeSessions";

    private final AtomicInteger activeSessions = new AtomicInteger();

    @Override
    public void contextInitialized(ServletContextEvent event) {
        event.getServletContext().setAttribute(ACTIVE_SESSIONS, activeSessions);
        log.info("Servlet portal ready at {}/portal/login", event.getServletContext().getContextPath());
    }

    @Override
    public void contextDestroyed(ServletContextEvent event) {
        event.getServletContext().removeAttribute(ACTIVE_SESSIONS);
    }

    @Override
    public void sessionCreated(HttpSessionEvent event) {
        activeSessions.incrementAndGet();
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent event) {
        activeSessions.decrementAndGet();
    }
}
