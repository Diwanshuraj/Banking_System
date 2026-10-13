package com.banking.repository;

import com.banking.model.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Spring Data JPA repository for {@link com.banking.model.SystemSetting}. */
public interface SystemSettingRepository extends JpaRepository<SystemSetting, Long> {

    Optional<SystemSetting> findBySettingKey(String settingKey);

    List<SystemSetting> findAllByOrderBySettingKeyAsc();
}
