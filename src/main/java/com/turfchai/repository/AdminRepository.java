package com.turfchai.repository;

import com.turfchai.model.Admin;
import com.turfchai.model.enums.AdminStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AdminRepository extends JpaRepository<Admin, Long> {

    @EntityGraph(attributePaths = {"user", "appointedBy"})
    List<Admin> findAllByOrderByIdAsc();

    Optional<Admin> findByUser_Id(Long userId);

    @EntityGraph(attributePaths = {"user", "appointedBy"})
    List<Admin> findByStatus(AdminStatus status);
}