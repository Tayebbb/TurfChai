package com.turfchai.dto.request;

import com.turfchai.model.enums.SkillLevel;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

/**
 * New LFG alert. The owner is taken from the bearer token, so there is
 * deliberately no user id here to be trusted.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateLfgAlertRequest {

    private Long sportId;

    private String sportName;

    @NotBlank(message = "Area is required")
    private String area;

    private String preferredDays;

    private LocalTime preferredFrom;

    private LocalTime preferredTo;

    private SkillLevel skillLevel;
}
