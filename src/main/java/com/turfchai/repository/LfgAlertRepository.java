package com.turfchai.repository;

import com.turfchai.model.LfgAlert;
import com.turfchai.model.enums.LfgStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LfgAlertRepository extends JpaRepository<LfgAlert, Long> {

    List<LfgAlert> findByUserId(Long userId);

    List<LfgAlert> findByUserIdAndStatus(Long userId, LfgStatus status);

    @Query("SELECT a FROM LfgAlert a WHERE a.status = 'ACTIVE' AND " +
           "LOWER(a.area) LIKE LOWER(CONCAT('%', :area, '%'))")
    List<LfgAlert> findMatchingAlerts(@Param("area") String area);
}
