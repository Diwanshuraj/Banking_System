package com.banking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Entry point: starts Spring Boot and its embedded Tomcat. Scheduling is enabled for the nightly fixed-deposit maturity job. */
@SpringBootApplication
@EnableScheduling
public class BankingBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BankingBackendApplication.class, args);
    }
}
