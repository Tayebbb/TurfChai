package com.turfchai.repository;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Optional<User> findByPublicId(String publicId);

    /**
     * Locks the user row so wallet balance can be read and spent atomically.
     *
     * <p>The wallet balance is a sum over a ledger, so two concurrent checkouts
     * could each read the same balance and each spend it in full, driving the
     * wallet negative. Serialising on the owning user row closes that window.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /**
     * Admin roster search. Filtering and paging happen in the database: the
     * admin screen used to call {@code findAll()} and filter 842 entities in
     * memory, then ship every one of them to the browser.
     *
     * @param term already lower-cased and wrapped in {@code %}, or null
     */
    @Query("""
            select u from User u
            where (:role is null or u.role = :role)
              and (:suspendedOnly = false or u.isSuspended = true or upper(u.status) = 'SUSPENDED')
              and (:status is null or upper(u.status) = upper(:status))
              and (:term is null
                   or lower(u.fullName) like :term
                   or lower(u.email) like :term
                   or lower(u.phone) like :term)
            """)
    Page<User> searchForAdmin(@Param("role") RoleType role,
                              @Param("suspendedOnly") boolean suspendedOnly,
                              @Param("status") String status,
                              @Param("term") String term,
                              Pageable pageable);
}
