package com.turfchai.dto.request;

import com.turfchai.model.enums.SkillLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateLfgAlertRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    private Long sportId;

    private String sportName;

    @NotBlank(message = "Area is required")
    private String area;

    private String preferredDays;

    private LocalTime preferredFrom;

    private LocalTime preferredTo;

    private SkillLevel skillLevel;
}
