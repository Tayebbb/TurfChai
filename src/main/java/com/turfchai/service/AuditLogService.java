package com.turfchai.service;

import com.turfchai.model.AuditLog;
import com.turfchai.repository.AuditLogRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    @Value("${spring.profiles.active:}")
    private String activeProfiles;

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog logAction(String adminName, Long adminId, String action, String actionTone, String target, String details) {
        AuditLog log = AuditLog.builder()
                .adminName(adminName)
                .adminId(adminId)
                .action(action)
                .actionTone(actionTone != null ? actionTone : "blue")
                .target(target)
                .details(details)
                .build();
        return auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogs(String filter, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        if (filter != null && !filter.isBlank() && !"All Activity".equalsIgnoreCase(filter)) {
            return auditLogRepository.findByActionContainingIgnoreCaseOrderByCreatedAtDesc(filter, pageable);
        }
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    @PostConstruct
    @Transactional
    public void seedInitialLogsIfEmpty() {
        if (!activeProfiles.contains("dev") && !activeProfiles.contains("test")) {
            return;
        }
        if (auditLogRepository.count() == 0) {
            List<AuditLog> seeds = List.of(
                AuditLog.builder().adminName("Farid Hasan").action("Approved Request").actionTone("green").target("TR-1039").details("GreenTurf Annex -> Listing published as pending venue setup").createdAt(OffsetDateTime.now().minusHours(2)).build(),
                AuditLog.builder().adminName("Nadia Amin").action("Suspended Player").actionTone("red").target("#38112").details("Reason: Repeated no-shows & abusive chat reports").createdAt(OffsetDateTime.now().minusHours(4)).build(),
                AuditLog.builder().adminName("Farid Hasan").action("Appointed Admin").actionTone("blue").target("Arman Habib").details("Granted role ADMIN with venues.write, payouts.write").createdAt(OffsetDateTime.now().minusHours(7)).build(),
                AuditLog.builder().adminName("Nadia Amin").action("Payout Released").actionTone("green").target("BATCH-048").details("৳4,82,000 disbursed across 38 venues").createdAt(OffsetDateTime.now().minusDays(1)).build(),
                AuditLog.builder().adminName("System Bot").action("System Alert").actionTone("amber").target("V-0077").details("Payout anomaly detected - flagged for manual review").createdAt(OffsetDateTime.now().minusDays(1).minusHours(3)).build(),
                AuditLog.builder().adminName("Farid Hasan").action("Rejected Request").actionTone("red").target("TR-1031").details("Mirpur Futsal Hub -> Missing trade license & NID document").createdAt(OffsetDateTime.now().minusDays(2)).build()
            );
            auditLogRepository.saveAll(seeds);
        }
    }
}
