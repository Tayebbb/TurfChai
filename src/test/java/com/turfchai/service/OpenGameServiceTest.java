package com.turfchai.service;

import com.turfchai.dto.request.CreateOpenGameRequest;
import com.turfchai.dto.request.JoinOpenGameRequest;
import com.turfchai.dto.response.JoinOpenGameResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.exception.*;
import com.turfchai.model.*;
import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.*;
import com.turfchai.service.impl.OpenGameServiceImpl;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OpenGameServiceTest {

    @Mock
    private OpenGameRepository openGameRepository;
    @Mock
    private OpenGameMembershipRepository membershipRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private VenueRepository venueRepository;
    @Mock
    private PitchRepository pitchRepository;

    @InjectMocks
    private OpenGameServiceImpl openGameService;

    private User organizer;
    private User player;
    private Venue venue;
    private OpenGame openGame;

    @BeforeEach
    void setUp() {
        organizer = User.builder()
                .id(1L)
                .fullName("Organizer User")
                .email("org@turfchai.com")
                .phone("+8801700000001")
                .passwordHash("hash")
                .role(RoleType.HOST)
                .reliabilityScore(95)
                .build();

        player = User.builder()
                .id(2L)
                .fullName("Player User")
                .email("player@turfchai.com")
                .phone("+8801700000002")
                .passwordHash("hash")
                .role(RoleType.PLAYER)
                .reliabilityScore(92)
                .playStyle(SkillLevel.INTERMEDIATE)
                .build();

        venue = Venue.builder()
                .id(10L)
                .venueCode("VEN-001")
                .name("Dhanmondi Turf Arena")
                .owner(organizer)
                .address("Dhanmondi 27")
                .area("Dhanmondi")
                .build();

        openGame = OpenGame.builder()
                .id(100L)
                .gameCode("OG-100")
                .title("Friday Night Football")
                .venue(venue)
                .gameDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(20, 0))
                .endTime(LocalTime.of(21, 30))
                .skillLevel(SkillLevel.INTERMEDIATE)
                .capacity(10)
                .filledCount(1)
                .pricePerPlayer(new BigDecimal("280.00"))
                .organizer(organizer)
                .status(OpenGameStatus.OPEN)
                .minimumReliability(90)
                .build();
    }

    @Test
    @DisplayName("Should create an open game successfully")
    void testCreateOpenGame_Success() {
        CreateOpenGameRequest request = CreateOpenGameRequest.builder()
                .title("Friday Night Football")
                .venueId(10L)
                .gameDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(20, 0))
                .endTime(LocalTime.of(21, 30))
                .skillLevel(SkillLevel.INTERMEDIATE)
                .capacity(10)
                .pricePerPlayer(new BigDecimal("280.00"))
                .build();

        when(venueRepository.findById(10L)).thenReturn(Optional.of(venue));
        when(userRepository.findById(1L)).thenReturn(Optional.of(organizer));
        when(openGameRepository.save(any(OpenGame.class))).thenAnswer(i -> i.getArgument(0));

        OpenGameResponse response = openGameService.createOpenGame(request, 1L);

        assertNotNull(response);
        assertEquals("Friday Night Football", response.getTitle());
        assertEquals(1, response.getFilledCount());
        verify(membershipRepository, times(1)).save(any(OpenGameMembership.class));
    }

    @Test
    @DisplayName("Should allow player to join open game successfully")
    void testJoinOpenGame_Success() {
        JoinOpenGameRequest request = JoinOpenGameRequest.builder().userId(2L).build();

        when(openGameRepository.findWithLockById(100L)).thenReturn(Optional.of(openGame));
        when(membershipRepository.existsByOpenGameIdAndUserId(100L, 2L)).thenReturn(false);
        when(userRepository.findById(2L)).thenReturn(Optional.of(player));
        when(membershipRepository.save(any(OpenGameMembership.class))).thenAnswer(i -> {
            OpenGameMembership m = i.getArgument(0);
            m.setId(500L);
            return m;
        });

        JoinOpenGameResponse response = openGameService.joinOpenGame(100L, request, 2L);

        assertTrue(response.getSuccess());
        assertEquals(2, openGame.getFilledCount());
        assertEquals(500L, response.getMembershipId());
        verify(openGameRepository, times(1)).save(openGame);
    }

    @Test
    @DisplayName("Should prevent joining when game is full")
    void testJoinOpenGame_GameFull() {
        openGame.setFilledCount(10);
        openGame.setStatus(OpenGameStatus.FULL);

        JoinOpenGameRequest request = JoinOpenGameRequest.builder().userId(2L).build();

        when(openGameRepository.findWithLockById(100L)).thenReturn(Optional.of(openGame));

        assertThrows(GameFullException.class, () -> openGameService.joinOpenGame(100L, request, 2L));
    }

    @Test
    @DisplayName("Should prevent duplicate joining by same user")
    void testJoinOpenGame_AlreadyJoined() {
        JoinOpenGameRequest request = JoinOpenGameRequest.builder().userId(2L).build();

        when(openGameRepository.findWithLockById(100L)).thenReturn(Optional.of(openGame));
        when(membershipRepository.existsByOpenGameIdAndUserId(100L, 2L)).thenReturn(true);

        assertThrows(AlreadyJoinedException.class, () -> openGameService.joinOpenGame(100L, request, 2L));
    }

    @Test
    @DisplayName("Should prevent joining if user reliability score is below minimum")
    void testJoinOpenGame_LowReliability() {
        player.setReliabilityScore(80); // minimum required is 90

        JoinOpenGameRequest request = JoinOpenGameRequest.builder().userId(2L).build();

        when(openGameRepository.findWithLockById(100L)).thenReturn(Optional.of(openGame));
        when(membershipRepository.existsByOpenGameIdAndUserId(100L, 2L)).thenReturn(false);
        when(userRepository.findById(2L)).thenReturn(Optional.of(player));

        assertThrows(LowReliabilityScoreException.class, () -> openGameService.joinOpenGame(100L, request, 2L));
    }

    @Test
    @DisplayName("Should prevent joining if skill level does not match requirement")
    void testJoinOpenGame_SkillMismatch() {
        openGame.setSkillLevel(SkillLevel.ADVANCED);
        player.setPlayStyle(SkillLevel.BEGINNER);

        JoinOpenGameRequest request = JoinOpenGameRequest.builder().userId(2L).build();

        when(openGameRepository.findWithLockById(100L)).thenReturn(Optional.of(openGame));
        when(membershipRepository.existsByOpenGameIdAndUserId(100L, 2L)).thenReturn(false);
        when(userRepository.findById(2L)).thenReturn(Optional.of(player));

        assertThrows(InvalidSkillLevelException.class, () -> openGameService.joinOpenGame(100L, request, 2L));
    }
}
