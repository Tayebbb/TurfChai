package com.turfchai.service;

import com.turfchai.dto.request.CreateLfgAlertRequest;
import com.turfchai.dto.response.LfgAlertResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.LfgAlert;
import com.turfchai.model.OpenGame;
import com.turfchai.model.User;
import com.turfchai.model.Venue;
import com.turfchai.model.enums.LfgStatus;
import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.LfgAlertRepository;
import com.turfchai.repository.OpenGameRepository;
import com.turfchai.repository.SportRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.service.impl.LfgAlertServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LfgAlertServiceTest {

    @Mock
    private LfgAlertRepository alertRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SportRepository sportRepository;
    @Mock
    private OpenGameRepository openGameRepository;

    @InjectMocks
    private LfgAlertServiceImpl alertService;

    private User user;
    private Venue venueDhanmondi;
    private Venue venueUttara;
    private OpenGame matchingGame;
    private OpenGame nonMatchingGame;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .fullName("LFG Player")
                .email("lfg@turfchai.com")
                .phone("+8801700000003")
                .passwordHash("hash")
                .role(RoleType.PLAYER)
                .build();

        venueDhanmondi = Venue.builder()
                .id(10L)
                .venueCode("VEN-010")
                .name("Dhanmondi Playzone")
                .area("Dhanmondi")
                .address("Road 27")
                .build();

        venueUttara = Venue.builder()
                .id(11L)
                .venueCode("VEN-011")
                .name("Uttara Arena")
                .area("Uttara")
                .address("Sector 3")
                .build();

        matchingGame = OpenGame.builder()
                .id(200L)
                .title("Evening 7-a-side")
                .venue(venueDhanmondi)
                .gameDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(20, 0))
                .endTime(LocalTime.of(21, 30))
                .skillLevel(SkillLevel.INTERMEDIATE)
                .capacity(10)
                .filledCount(6)
                .pricePerPlayer(new BigDecimal("300"))
                .status(OpenGameStatus.OPEN)
                .build();

        nonMatchingGame = OpenGame.builder()
                .id(201L)
                .title("Uttara Advanced Game")
                .venue(venueUttara)
                .gameDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 30))
                .skillLevel(SkillLevel.ADVANCED)
                .capacity(10)
                .filledCount(8)
                .pricePerPlayer(new BigDecimal("350"))
                .status(OpenGameStatus.OPEN)
                .build();
    }

    @Test
    @DisplayName("Should create LFG alert successfully")
    void testCreateAlert_Success() {
        CreateLfgAlertRequest request = CreateLfgAlertRequest.builder()
                .userId(1L)
                .area("Dhanmondi")
                .preferredFrom(LocalTime.of(19, 0))
                .preferredTo(LocalTime.of(22, 0))
                .skillLevel(SkillLevel.INTERMEDIATE)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(alertRepository.save(any(LfgAlert.class))).thenAnswer(i -> {
            LfgAlert a = i.getArgument(0);
            a.setId(300L);
            return a;
        });

        LfgAlertResponse response = alertService.createAlert(request);

        assertNotNull(response);
        assertEquals("Dhanmondi", response.getArea());
        assertEquals("ACTIVE", response.getStatus());
        verify(alertRepository, times(1)).save(any(LfgAlert.class));
    }

    @Test
    @DisplayName("Should find matching games for LFG alert based on area, skill, and time")
    void testFindMatchesForAlert_MatchingCriteria() {
        LfgAlert alert = LfgAlert.builder()
                .id(300L)
                .user(user)
                .area("Dhanmondi")
                .preferredFrom(LocalTime.of(19, 0))
                .preferredTo(LocalTime.of(22, 0))
                .skillLevel(SkillLevel.INTERMEDIATE)
                .status(LfgStatus.ACTIVE)
                .build();

        when(alertRepository.findById(300L)).thenReturn(Optional.of(alert));
        when(openGameRepository.findByStatusIn(anyList())).thenReturn(List.of(matchingGame, nonMatchingGame));

        List<OpenGameResponse> matches = alertService.findMatchesForAlert(300L);

        assertEquals(1, matches.size());
        assertEquals("Evening 7-a-side", matches.get(0).getTitle());
        assertEquals("Dhanmondi", matches.get(0).getArea());
    }

    @Test
    @DisplayName("Should update alert status successfully")
    void testUpdateAlertStatus_Success() {
        LfgAlert alert = LfgAlert.builder()
                .id(300L)
                .user(user)
                .area("Dhanmondi")
                .status(LfgStatus.ACTIVE)
                .build();

        when(alertRepository.findById(300L)).thenReturn(Optional.of(alert));
        when(alertRepository.save(any(LfgAlert.class))).thenAnswer(i -> i.getArgument(0));

        LfgAlertResponse response = alertService.updateAlertStatus(300L, 1L, LfgStatus.PAUSED);

        assertEquals("PAUSED", response.getStatus());
    }
}
