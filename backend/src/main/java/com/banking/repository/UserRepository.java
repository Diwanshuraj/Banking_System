package com.banking.repository;

import com.banking.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByCustomerId(String customerId);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByCustomerId(String customerId);

    boolean existsByPanNumber(String panNumber);

    long countByRole(User.Role role);

    List<User> findAllByOrderByCreatedAtDesc();

    @Query("""
            select u from User u
            where lower(u.fullName) like lower(concat('%', :q, '%'))
               or lower(u.email) like lower(concat('%', :q, '%'))
               or u.phone like concat('%', :q, '%')
               or u.customerId like concat('%', :q, '%')
               or upper(u.panNumber) like upper(concat('%', :q, '%'))
            order by u.createdAt desc
            """)
    List<User> search(@Param("q") String q);
}
