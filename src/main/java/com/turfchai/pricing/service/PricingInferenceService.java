package com.turfchai.pricing.service;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import com.turfchai.pricing.dto.PricingQuoteRequest;
import com.turfchai.pricing.dto.PricingQuoteResponse;
import com.turfchai.pricing.entity.WeatherForecastGridId;
import com.turfchai.pricing.repository.HolidayRepository;
import com.turfchai.pricing.repository.WeatherForecastGridRepository;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.SportPricingRuleRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PricingInferenceService {

    /** Used only when an owner has not set a base price yet. */
    private static final float FALLBACK_BASE_RATE = 1000.0f;

    private final VenueRepository venueRepository;
    private final HolidayRepository holidayRepository;
    private final WeatherForecastGridRepository weatherForecastGridRepository;
    private final SportPricingRuleRepository pricingRuleRepository;

    private volatile OrtEnvironment env;
    private volatile OrtSession session;

    /**
     * Lazily loads the ONNX pricing model via file stream or direct file path.
     * Prevents loading the model into JVM heap byte arrays, avoiding
     * OutOfMemoryError
     * on memory-constrained deployments (such as Render free/starter tiers).
     */
    private synchronized void ensureModelLoaded() throws Exception {
        if (session != null) {
            return;
        }

        log.info("Initializing ONNX pricing model environment lazily...");
        env = OrtEnvironment.getEnvironment();
        ClassPathResource resource = new ClassPathResource("ml_models/pricing_model.onnx");

        File modelFile;
        if (resource.isFile()) {
            modelFile = resource.getFile();
        } else {
            modelFile = File.createTempFile("pricing_model_", ".onnx");
            modelFile.deleteOnExit();
            try (InputStream is = resource.getInputStream()) {
                Files.copy(is, modelFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        }

        session = env.createSession(modelFile.getAbsolutePath(), new OrtSession.SessionOptions());
        log.info("ONNX pricing model loaded successfully from file path: {}", modelFile.getAbsolutePath());
    }

    public PricingQuoteResponse getQuote(PricingQuoteRequest request) throws Exception {
        ensureModelLoaded();

        Venue venue = venueRepository.findById(request.getVenueId())
                .orElseThrow(() -> new IllegalArgumentException("Venue not found"));

        LocalDateTime dt = request.getBookingDateTime();

        // 1. day
        float day = dt.getDayOfMonth();
        // 2. month
        float month = dt.getMonthValue();
        // 3. hour
        float hour = dt.getHour();
        // 4. weekend (Friday = 5, Saturday = 6 in Java DayOfWeek)
        DayOfWeek dow = dt.getDayOfWeek();
        float weekend = (dow == DayOfWeek.FRIDAY || dow == DayOfWeek.SATURDAY) ? 1.0f : 0.0f;
        // 5. publicHoliday
        float publicHoliday = holidayRepository.existsById(dt.toLocalDate()) ? 1.0f : 0.0f;
        // 6. daysBeforeBooking
        float daysBeforeBooking = request.getDaysBeforeBooking();
        // 7. weatherCondition
        float weatherCondition = 0.0f; // Default Clear
        if (venue.getLat() != null && venue.getLng() != null) {
            BigDecimal gridLat = venue.getLat().setScale(2, RoundingMode.HALF_UP);
            BigDecimal gridLon = venue.getLng().setScale(2, RoundingMode.HALF_UP);
            WeatherForecastGridId gridId = new WeatherForecastGridId(gridLat, gridLon,
                    dt.truncatedTo(ChronoUnit.HOURS).atOffset(ZoneOffset.UTC));
            weatherCondition = weatherForecastGridRepository.findById(gridId)
                    .map(grid -> (float) grid.getWeatherCondition())
                    .orElse(0.0f);
        }
        // 8. occupancyRate
        float occupancyRate = request.getOccupancyRate();
        // 9. timeSlot
        float timeSlot = (hour <= 15) ? 0.0f : 1.0f;

        float[][] features = new float[][] {
                { day, month, hour, weekend, publicHoliday, daysBeforeBooking, weatherCondition, occupancyRate,
                        timeSlot }
        };

        try (OnnxTensor tensor = OnnxTensor.createTensor(env, features)) {
            OrtSession.Result result = session.run(Collections.singletonMap("float_input", tensor));
            float[][] output = (float[][]) result.get(0).getValue();
            float multiplier = output[0][0];

            float baseRate = resolveBaseRate(request.getVenueId(), request.getSportSlug());
            float suggestedPrice = baseRate * multiplier;

            PricingQuoteResponse.FeatureBreakdown breakdown = PricingQuoteResponse.FeatureBreakdown.builder()
                    .day(day)
                    .month(month)
                    .hour(hour)
                    .weekend(weekend)
                    .publicHoliday(publicHoliday)
                    .daysBeforeBooking(daysBeforeBooking)
                    .weatherCondition(weatherCondition)
                    .occupancyRate(occupancyRate)
                    .timeSlot(timeSlot)
                    .build();

            return PricingQuoteResponse.builder()
                    .multiplier(multiplier)
                    .baseRate(baseRate)
                    .suggestedPrice(suggestedPrice)
                    .featureBreakdown(breakdown)
                    .build();
        }
    }

    /**
     * The owner sets one base price per sport; peak and off-peak are this model's
     * job.
     * A FULL_DAY rule is that base price — anything else is a legacy window, so the
     * cheapest of those stands in for it.
     */
    private float resolveBaseRate(Long venueId, String sportSlug) {
        List<SportPricingRule> rules = pricingRuleRepository.findActiveByVenueId(venueId);
        if (sportSlug != null && !sportSlug.isBlank()) {
            List<SportPricingRule> forSport = rules.stream()
                    .filter(rule -> rule.getSport().getSlug().equalsIgnoreCase(sportSlug))
                    .toList();
            if (!forSport.isEmpty()) {
                rules = forSport;
            }
        }
        return rules.stream()
                .min(Comparator
                        .comparingInt(
                                (SportPricingRule rule) -> "FULL_DAY".equalsIgnoreCase(rule.getWindowType()) ? 0 : 1)
                        .thenComparing(SportPricingRule::getRate))
                .map(rule -> rule.getRate().floatValue())
                .orElse(FALLBACK_BASE_RATE);
    }
}
