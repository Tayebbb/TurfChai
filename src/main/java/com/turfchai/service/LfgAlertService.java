package com.turfchai.service;

import com.turfchai.dto.request.CreateLfgAlertRequest;
import com.turfchai.dto.response.LfgAlertResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.enums.LfgStatus;

import java.util.List;

public interface LfgAlertService {
    LfgAlertResponse createAlert(CreateLfgAlertRequest request);
    List<LfgAlertResponse> getUserAlerts(Long userId);
    LfgAlertResponse updateAlertStatus(Long alertId, Long userId, LfgStatus status);
    void deleteAlert(Long alertId, Long userId);
    List<OpenGameResponse> findMatchesForAlert(Long alertId);
}
