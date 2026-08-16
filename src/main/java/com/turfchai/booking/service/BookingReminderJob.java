package com.turfchai.booking.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.service.NotificationService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Reminds players about a confirmed booking that starts soon.
 *
 * <p>
 * The job is safe to run as often as it likes: the reminder is written through
 * {@link NotificationService#sendOnce}, keyed on the booking, so a booking is
 * only ever reminded about once however many times the window is scanned.
 */
@Component
@RequiredArgsConstructor
public class BookingReminderJob {

    /** How far ahead a slot has to be before it is worth a reminder. */
    static final int LEAD_HOURS = 24;

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH);

    private final BookingRepository bookingRepository;
    private final VenueRepository venueRepository;
    private final NotificationService notificationService;

    @Scheduled(cron = "0 5 * * * *")
    @Transactional
    public void remindUpcomingBookings() {
        sendRemindersAsOf(LocalDateTime.now());
    }

    /** The same sweep against an explicit "now", so the window is testable. */
    @Transactional
    public int sendRemindersAsOf(LocalDateTime now) {
        LocalDateTime until = now.plusHours(LEAD_HOURS);
        int sent = 0;
        for (LocalDate date : List.of(now.toLocalDate(), until.toLocalDate()).stream().distinct().toList()) {
            for (Booking booking : bookingRepository.findByStatusAndBookingDate(BookingStatus.CONFIRMED, date)) {
                if (booking.getStartTime() == null || booking.getId() == null) {
                    continue;
                }
                LocalDateTime startsAt = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
                if (startsAt.isBefore(now) || startsAt.isAfter(until)) {
                    continue;
                }
                boolean written = notificationService.sendOnce(booking.getUserId(), "BOOKING_REMINDER",
                        "Playing " + DATE.format(startsAt) + " · " + venueName(booking.getVenueId()),
                        "Kick-off at " + TIME.format(startsAt) + ". Booking code " + booking.getBookingCode() + ".",
                        "/player/bookings/" + booking.getId());
                if (written) {
                    sent++;
                }
            }
        }
        return sent;
    }

    private String venueName(Long venueId) {
        if (venueId == null) {
            return "your turf";
        }
        return venueRepository.findById(venueId).map(Venue::getName).orElse("your turf");
    }
}
