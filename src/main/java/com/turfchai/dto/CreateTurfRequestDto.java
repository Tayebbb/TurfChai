package com.turfchai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTurfRequestDto {

    @NotBlank(message = "Venue name is required")
    private String venueName;

    @NotBlank(message = "Area is required")
    private String area;

    private Integer pitchCount;
    private String sportsCsv;
    private String ownerPhone;
    private String ownerEmail;
    private String docTradeLicense;
    private String docOwnerNid;
    private String docUtilityBill;
    private java.util.List<String> photos;
}
