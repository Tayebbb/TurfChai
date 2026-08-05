package com.turfchai.service;

import com.turfchai.dto.request.AppointAdminRequest;
import com.turfchai.dto.response.AdminResponse;

import java.util.List;
import java.util.Map;

public interface AdminService {

    List<AdminResponse> listAdmins(Long currentUserId);

    AdminResponse appoint(AppointAdminRequest request, Long appointingUserId);

    AdminResponse updatePermissions(Long adminId, Map<String, Object> permissions);

    AdminResponse deactivate(Long adminId, Long currentUserId);
}