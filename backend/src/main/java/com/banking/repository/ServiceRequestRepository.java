package com.banking.repository;

import com.banking.model.ServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {

    List<ServiceRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<ServiceRequest> findByStatusOrderByCreatedAtDesc(ServiceRequest.RequestStatus status);

    List<ServiceRequest> findAllByOrderByCreatedAtDesc();

    long countByStatusIn(Collection<ServiceRequest.RequestStatus> statuses);

    boolean existsByTicketNumber(String ticketNumber);
}
