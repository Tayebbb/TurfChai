package com.turfchai.repository;

import com.turfchai.model.TurfRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TurfRequestRepository extends JpaRepository<TurfRequest, Long> {

    List<TurfRequest> findByStatusOrderByCreatedAtAsc(String status);

    List<TurfRequest> findByOwnerUserIdOrderByCreatedAtDesc(Long ownerUserId);

    List<TurfRequest> findByOwnerEmailOrderByCreatedAtDesc(String ownerEmail);

    Optional<TurfRequest> findByRequestCode(String requestCode);

    List<TurfRequest> findAllByOrderByCreatedAtDesc();
}
