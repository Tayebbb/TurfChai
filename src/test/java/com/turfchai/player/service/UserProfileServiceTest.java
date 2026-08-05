package com.turfchai.player.service;

import com.turfchai.player.api.UserProfileRestController;
import com.turfchai.player.dto.PlayerProfileDto;
import com.turfchai.player.dto.UpdateProfileRequest;
import com.turfchai.player.repository.SavedVenueRepository;
import com.turfchai.player.repository.UserRepository;
import com.turfchai.venue.VenueTestData;
import com.turfchai.venue.dto.VenueSummaryDto;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.repository.SportRepository;
import com.turfchai.venue.repository.VenueRepository;
import com.turfchai.venue.service.VenueSearchService.VenueNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:profile-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class UserProfileServiceTest {

    private static final UUID DEMO = UserProfileRestController.DEMO_USER_ID;

    @Autowired
    private UserProfileService service;
    @Autowired
    private UserRepository users;
    @Autowired
    private SavedVenueRepository savedVenues;
    @Autowired
    private VenueRepository venues;
    @Autowired
    private SportRepository sports;

    @BeforeEach
    void setUp() {
        savedVenues.deleteAll();
    }

    @Test
    void getProfileReturnsSeededDemoPlayer() {
        PlayerProfileDto profile = service.getProfile(DEMO);
        assertThat(profile.fullName()).isEqualTo("Rafiul Karim");
        assertThat(profile.preferredSports()).contains("football", "cricket");
    }

    @Test
    void unknownUserRaisesNotFound() {
        assertThatThrownBy(() -> service.getProfile(UUID.randomUUID()))
                .isInstanceOf(UserProfileService.UserNotFoundException.class);
    }

    @Test
    void partialUpdateChangesOnlyProvidedFields() {
        PlayerProfileDto before = service.getProfile(DEMO);
        PlayerProfileDto after = service.updateProfile(DEMO, new UpdateProfileRequest(
                "Nazia Rahman", null, "Weekend striker", "advanced", null, List.of("Futsal"), null));

        assertThat(after.fullName()).isEqualTo("Nazia Rahman");
        assertThat(after.avatarInitials()).isEqualTo("NR");   // derived from new name
        assertThat(after.bio()).isEqualTo("Weekend striker");
        assertThat(after.playStyle()).isEqualTo("advanced");
        assertThat(after.preferredSports()).containsExactly("futsal");  // normalized lower-case
        assertThat(after.area()).isEqualTo(before.area());              // untouched
        assertThat(after.playerRole()).isEqualTo(before.playerRole());  // untouched
    }

    @Test
    void savedVenueToggleAddsThenRemoves() {
        Sport football = VenueTestData.sport(sports, "football");
        var venue = VenueTestData.venue(venues, "toggle-arena", "Uttara", 4.0, true,
                "floodlights", 1800, football);

        assertThat(service.toggleSavedVenue(DEMO, venue.getSlug())).isTrue();
        List<VenueSummaryDto> saved = service.listSavedVenues(DEMO);
        assertThat(saved).extracting(VenueSummaryDto::slug).containsExactly("toggle-arena");
        assertThat(service.isSaved(DEMO, venue.getSlug())).isTrue();

        assertThat(service.toggleSavedVenue(DEMO, venue.getSlug())).isFalse();
        assertThat(service.listSavedVenues(DEMO)).isEmpty();
    }

    @Test
    void togglingUnknownVenueRaisesNotFound() {
        assertThatThrownBy(() -> service.toggleSavedVenue(DEMO, "ghost-venue"))
                .isInstanceOf(VenueNotFoundException.class);
    }

    @Test
    void savedVenuesPersistPerUserOnly() {
        Sport football = VenueTestData.sport(sports, "football");
        var venue = VenueTestData.venue(venues, "isolated-arena", "Banani", 4.1, false,
                "parking", 2000, football);
        service.toggleSavedVenue(DEMO, venue.getSlug());

        var other = new com.turfchai.player.entity.User();
        other.setFullName("Other Player");
        other.setEmail("other@turfchai.dev");
        users.save(other);

        assertThat(service.listSavedVenues(other.getPublicId())).isEmpty();
    }
}
