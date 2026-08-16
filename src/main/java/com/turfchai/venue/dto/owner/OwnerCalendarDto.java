package com.turfchai.venue.dto.owner;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OwnerCalendarDto {

    private Long venueId;
    private String venueName;
    private LocalDate date;
    private List<PitchHeaderDto> pitches;
    private List<TimeRowDto> rows;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PitchHeaderDto {
        private Long id;
        private String name;
        private String sizeLabel;
        private List<String> sports;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeRowDto {
        private String time;
        private List<CellDto> cells;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CellDto {
        private Long slotId;
        private Long pitchId;
        private String kind; // "event" or "add"
        private String variant; // "online", "phone", "walkin", "tournament", "blocked", "held"
        private String label;
        private Boolean openable;
        private String status;
        private Double price;
        /**
         * The live booking on this slot, when there is one — drives the owner's slot
         * actions.
         */
        private Long bookingId;
        private String bookingCode;
        private String customerName;
        private String customerPhone;
        private Boolean checkedIn;
    }
}
