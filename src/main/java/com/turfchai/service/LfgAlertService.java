package com.turfchai.service;

import com.turfchai.dto.request.CreateLfgAlertRequest;
import com.turfchai.dto.response.LfgAlertResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.enums.LfgStatus;

import java.util.List;

/**
 * LFG ("looking for game") availability alerts.
 *
 * <p>Every method takes the caller's own id, resolved from the bearer token by
 * the controller. Nothing here accepts a user id supplied by the client, so an
 * alert cannot be read, changed or deleted on someone else's behalf.
 */
public interface LfgAlertService {

    LfgAlertResponse createAlert(Long ownerId, CreateLfgAlertRequest request);

    List<LfgAlertResponse> getUserAlerts(Long ownerId);

    LfgAlertResponse updateAlertStatus(Long alertId, Long callerId, LfgStatus status);

    void deleteAlert(Long alertId, Long callerId);

    List<OpenGameResponse> findMatchesForAlert(Long alertId, Long callerId);
}
