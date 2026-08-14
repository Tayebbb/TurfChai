package com.turfchai.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The scanned QR payload, submitted by gate staff. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckInRequest {

    @NotBlank(message = "Scan a ticket QR code first")
    @Size(max = 200, message = "That is not a TurfChai ticket")
    private String token;
}
