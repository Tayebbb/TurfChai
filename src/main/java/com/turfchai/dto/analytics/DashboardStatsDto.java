package com.turfchai.dto.analytics;

public record DashboardStatsDto(
    long pendingRequests,
    long activeTurfs,
    long registeredUsers,
    long adminAccounts
) {}
