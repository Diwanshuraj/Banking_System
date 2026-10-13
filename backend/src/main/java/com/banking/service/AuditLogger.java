package com.banking.service;

import com.banking.exception.DatabaseException;
import com.banking.jdbc.AuditEvent;
import com.banking.jdbc.AuditLogDao;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Producer-consumer audit log. Request threads only enqueue events (fast, never touches the database);
 * one background thread drains the queue and writes events in JDBC batches.
 */
@Slf4j
@Service
public class AuditLogger {

    private static final int MAX_BATCH = 100;

    private final AuditLogDao dao;
    private final BlockingQueue<AuditEvent> queue = new LinkedBlockingQueue<>(10_000);
    private final AtomicLong submitted = new AtomicLong();
    /** Events written, or given up on, by the worker. Guarded by {@code this}. */
    private long processed;
    private volatile boolean running;
    private Thread worker;

    public AuditLogger(AuditLogDao dao) {
        this.dao = dao;
    }

    @PostConstruct
    void start() {
        try {
            dao.createTableIfMissing();
        } catch (DatabaseException e) {
            log.error("Audit log disabled: {}", e.getMessage());
            return;
        }
        running = true;
        worker = new Thread(this::drainLoop, "audit-log-writer");
        worker.setDaemon(true);
        worker.start();
    }

    @PreDestroy
    void stop() throws InterruptedException {
        running = false;
        if (worker != null) worker.join(TimeUnit.SECONDS.toMillis(5));
    }

    /** Queues an event; returns immediately. Drops the event if the queue is full. */
    public void record(AuditEvent event) {
        if (!running) return;
        submitted.incrementAndGet();
        if (!queue.offer(event)) {
            log.warn("Audit queue full; dropped {} for user {}", event.action(), event.userId());
            markProcessed(1);
        }
    }

    /** Waits until everything queued before this call has been written, or the timeout passes. */
    public void flush(long timeoutMillis) throws InterruptedException {
        long target = submitted.get();
        long deadline = System.currentTimeMillis() + timeoutMillis;
        synchronized (this) {
            while (processed < target) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) return;
                wait(remaining);
            }
        }
    }

    private void drainLoop() {
        while (running || !queue.isEmpty()) {
            try {
                AuditEvent first = queue.poll(500, TimeUnit.MILLISECONDS);
                if (first == null) continue;
                List<AuditEvent> batch = new ArrayList<>();
                batch.add(first);
                queue.drainTo(batch, MAX_BATCH - 1);
                try {
                    dao.insertAll(batch);
                } catch (DatabaseException e) {
                    log.error("Lost {} audit events: {}", batch.size(), e.getMessage());
                }
                markProcessed(batch.size());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private synchronized void markProcessed(int count) {
        processed += count;
        notifyAll();
    }
}
