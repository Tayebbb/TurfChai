package com.turfchai.repository;

import com.turfchai.model.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {

    List<BankAccount> findByOwnerUserId(Long ownerUserId);
}
