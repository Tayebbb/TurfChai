package com.turfchai.pricing.service;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import com.turfchai.pricing.dto.PricingQuoteRequest;
import com.turfchai.pricing.dto.PricingQuoteResponse;
import com.turfchai.pricing.entity.WeatherForecastGridId;
import com.turfchai.pricing.repository.HolidayRepository;
import com.turfchai.pricing.repository.WeatherForecastGridRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Collections;

@Service
@RequiredArgsConstructor
@Slf4j
public class PricingInferenceService {

    private final VenueRepository venueRepository;
    private final HolidayRepository holidayRepository;
    private final WeatherForecastGridRepository weatherForecastGridRepository;

    private OrtEnvironment env;
    private OrtSession session;

    @PostConstruct
    public void init() {
        try {
            env = OrtEnvironment.getEnvironment();
            ClassPathResource resource = new ClassPathResource("ml_models/pricing_model.onnx");
            byte[] modelArray = resource.getInputStream().readAllBytes();
            session = env.createSession(modelArray, new OrtSession.SessionOptions());
            log.info("ONNX pricing model loaded successfully.");
        } catch (Throwable e) {
            log.error("Failed to load ONNX pricing model. The ML API will not be available.", e);
        }
    }

    public PricingQuoteResponse getQuote(PricingQuoteRequest request) throws Exception {
        if (session == null) {
            throw new IllegalStateException("ONNX model failed to initialize. Please check logs.");
        }
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
            WeatherForecastGridId gridId = new WeatherForecastGridId(gridLat, gridLon, dt.truncatedTo(ChronoUnit.HOURS).atOffset(ZoneOffset.UTC));
            weatherCondition = weatherForecastGridRepository.findById(gridId)
                    .map(grid -> (float) grid.getWeatherCondition())
                    .orElse(0.0f);
        }
        // 8. occupancyRate
        float occupancyRate = request.getOccupancyRate();
        // 9. timeSlot
        float timeSlot = (hour <= 15) ? 0.0f : 1.0f;

        float[][] features = new float[][]{
                {day, month, hour, weekend, publicHoliday, daysBeforeBooking, weatherCondition, occupancyRate, timeSlot}
        };

        try (OnnxTensor tensor = OnnxTensor.createTensor(env, features)) {
            OrtSession.Result result = session.run(Collections.singletonMap("float_input", tensor));
            float[][] output = (float[][]) result.get(0).getValue();
            float multiplier = output[0][0];

            float baseRate = venue.getBasePrice() != null
                    ? venue.getBasePrice().floatValue()
                    : 1000.0f;
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
}
