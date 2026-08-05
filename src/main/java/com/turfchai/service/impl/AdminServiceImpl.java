package com.turfchai.service.impl;

import com.turfchai.dto.request.AppointAdminRequest;
import com.turfchai.dto.response.AdminResponse;
import com.turfchai.exception.AdminActionException;
import com.turfchai.exception.AdminNotFoundException;
import com.turfchai.exception.EmailAlreadyExistsException;
import com.turfchai.exception.PhoneAlreadyExistsException;
import com.turfchai.model.Admin;
import com.turfchai.model.User;
import com.turfchai.model.enums.AdminRole;
import com.turfchai.model.enums.AdminStatus;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.AdminRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private static final Map<String, Boolean> DEFAULT_PERMISSIONS = Map.of(
            "perm_review", false,
            "perm_listings", false,
            "perm_users", false,
            "perm_reports", false
    );

    private final AdminRepository adminRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public List<AdminResponse> listAdmins(Long currentUserId) {
        return adminRepository.findAllByOrderByIdAsc().stream()
                .map(admin -> toResponse(admin, currentUserId))
                .toList();
    }

    @Override
    @Transactional
    public AdminResponse appoint(AppointAdminRequest request, Long appointingUserId) {
        User appointing = requireUser(appointingUserId, "Appointing admin does not exist");
        requireSuperAdmin(appointing);

        if (request.adminRole() == AdminRole.SUPER) {
            throw new AdminActionException("A second super admin cannot be appointed — the platform has a single super admin");
        }

        String email = request.email().trim().toLowerCase();
        String phone = request.phone().trim();

        if (userRepository.findByEmail(email).isPresent()) {
            throw new EmailAlreadyExistsException("An account already exists with email: " + email);
        }
        if (userRepository.findByPhone(phone).isPresent()) {
            throw new PhoneAlreadyExistsException("An account already exists with phone: " + phone);
        }

        User adminUser = User.builder()
                .fullName(request.fullName().trim())
                .email(email)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(request.temporaryPassword()))
                .role(RoleType.ADMIN)
                .status("ACTIVE")
                .avatarInitials(initials(request.fullName()))
                .build();
        adminUser = userRepository.save(adminUser);

        Map<String, Object> permissions = new LinkedHashMap<>(DEFAULT_PERMISSIONS);
        if (request.permissions() != null) {
            permissions.putAll(request.permissions());
        }

        Admin admin = Admin.builder()
                .user(adminUser)
                .adminRole(request.adminRole())
                .permissions(permissions)
                .appointedBy(appointing)
                .status(AdminStatus.ACTIVE)
                .build();
        admin = adminRepository.save(admin);

        return toResponse(admin, appointingUserId);
    }

    @Override
    @Transactional
    public AdminResponse updatePermissions(Long adminId, Map<String, Object> permissions) {
        Admin admin = requireAdmin(adminId);
        Map<String, Object> merged = new LinkedHashMap<>(DEFAULT_PERMISSIONS);
        if (permissions != null) {
            merged.putAll(permissions);
        }
        admin.setPermissions(merged);
        return toResponse(adminRepository.save(admin), admin.getUser().getId());
    }

    @Override
    @Transactional
    public AdminResponse deactivate(Long adminId, Long currentUserId) {
        Admin admin = requireAdmin(adminId);
        if (admin.getUser().getId().equals(currentUserId)) {
            throw new AdminActionException("You cannot deactivate your own admin account");
        }
        if (admin.getUser().getRole() == RoleType.SUPER_ADMIN) {
            throw new AdminActionException("The super admin account cannot be deactivated");
        }
        admin.setStatus(AdminStatus.DISABLED);
        return toResponse(adminRepository.save(admin), currentUserId);
    }

    private Admin requireAdmin(Long adminId) {
        return adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminNotFoundException("Admin account not found: " + adminId));
    }

    private User requireUser(Long userId, String message) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new AdminNotFoundException(message));
    }

    private void requireSuperAdmin(User user) {
        if (user.getRole() != RoleType.SUPER_ADMIN) {
            throw new AdminActionException("Only the super admin can manage admin accounts");
        }
    }

    private AdminResponse toResponse(Admin admin, Long currentUserId) {
        User user = admin.getUser();
        String appointedByName = admin.getAppointedBy() != null ? admin.getAppointedBy().getFullName() : null;
        return new AdminResponse(
                admin.getId(),
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getAvatarInitials(),
                admin.getAdminRole(),
                admin.getStatus(),
                admin.getPermissions(),
                appointedByName,
                admin.getAppointedAt(),
                admin.getLastActiveAt(),
                user.getId().equals(currentUserId)
        );
    }

    private String initials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "??";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    }
}