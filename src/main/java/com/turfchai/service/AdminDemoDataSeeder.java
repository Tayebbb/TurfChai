package com.turfchai.service;

import com.turfchai.model.TurfRequest;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.TurfRequestRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Auto-seeds a realistic demo dataset on startup.
 * Triggers when the {@code users} table has fewer than 50 rows.
 *
 * <p>
 * <b>Demo data only.</b> Restricted to the dev/test/ci profiles: this writes
 * hundreds of fabricated users, venues and turf requests, which must never
 * reach a real database.
 *
 * <p>
 * Part A of the AdminDemoDataSeeder plan:
 * <ul>
 * <li>800 Users across all roles, spread over 6 months</li>
 * <li>40 Venues with 2–3 Pitches each (Dhaka areas)</li>
 * <li>10 TurfRequests in various states</li>
 * </ul>
 */
@Slf4j
@Component
@Profile({ "dev", "test", "ci", "docker" })
@Order(10)
@RequiredArgsConstructor
public class AdminDemoDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final TurfRequestRepository turfRequestRepository;
    private final PasswordEncoder passwordEncoder;

    private static final Random RNG = new Random(42L); // deterministic seed

    // ── Name pools ────────────────────────────────────────────────────────

    private static final String[] FIRST_NAMES = {
            "Fahim", "Nadia", "Tariq", "Meem", "Rahim", "Sadia", "Arman", "Tania",
            "Imran", "Riya", "Karim", "Fatema", "Jakir", "Layla", "Rasel", "Sumaiya",
            "Shamim", "Nusrat", "Naim", "Mitu", "Riyad", "Sabina", "Farhan", "Ayesha",
            "Sagor", "Jannatul", "Mizan", "Tasnim", "Rubel", "Noor", "Abdur", "Rifat",
            "Masum", "Shirin", "Pavel", "Brishty", "Shakil", "Parveen", "Shohag", "Meher",
            "Habib", "Sunita", "Zahid", "Liza", "Tomal", "Ruma", "Babu", "Tamanna",
            "Robin", "Moni"
    };

    private static final String[] LAST_NAMES = {
            "Rahman", "Hossain", "Islam", "Amin", "Chowdhury", "Ahmed", "Khan", "Sultana",
            "Begum", "Malik", "Sarkar", "Molla", "Hasan", "Uddin", "Mia", "Bhuiyan",
            "Dey", "Roy", "Paul", "Biswas"
    };

    private static final String[] AREAS = {
            "Mirpur", "Gulshan", "Dhanmondi", "Banani", "Mohammadpur",
            "Uttara", "Badda", "Rampura", "Wari", "Khilgaon"
    };

    private static final String[] VENUE_PHOTO_URLS = {
            "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
            "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80",
            "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&q=80",
            "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80",
            "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80",
            "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80",
            "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80",
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
            "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=800&q=80",
            "https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&q=80"
    };

    /**
     * Weighted acquisition-channel distribution (100 entries) assigned to users.
     */
    private static final String[] SIGNUP_CHANNELS = buildChannelPool();

    private static String[] buildChannelPool() {
        String[] pool = new String[100];
        String[][] plan = {
                { "Organic Search", "30" },
                { "Direct", "20" },
                { "Meta/Facebook Ads", "20" },
                { "App Store Referral", "15" },
                { "TikTok Campaigns", "10" },
                { "Referrals", "5" },
        };
        int idx = 0;
        for (String[] entry : plan) {
            int count = Integer.parseInt(entry[1]);
            for (int i = 0; i < count; i++) {
                pool[idx++] = entry[0];
            }
        }
        return pool;
    }

    private static final String[] VENUE_NAMES = {
            "Kick-Off Arena", "GreenTurf Annex", "Champions Ground", "Futsal Hub Dhaka",
            "Prime Pitch Mirpur", "Skyline Sports Complex", "TurfMaster Gulshan",
            "Goal Line Arena", "The Pitch House", "Elite Futsal Zone",
            "Victory Ground", "Blue Star Arena", "Sunrise Sports Club",
            "Urban Turf Co.", "Lightning Fields", "Alpha Futsal", "Dream Pitch",
            "Phoenix Arena", "Royal Turf Club", "Flash Kick Arena",
            "Goal Rush Ground", "TurfNation", "Sportika Dhaka", "Kickstart Arena",
            "Green Star Futsal", "PlayZone Uttara", "Pro Pitch Banani",
            "Arena X Rampura", "City Kick Arena", "TurfWorld Dhanmondi",
            "SuperField Badda", "Metro Futsal", "Thunder Ground", "Apex Sports Hub",
            "Precision Pitch", "Turf Republic", "SportSkill Arena", "FastFoot Hub",
            "Zone 5 Futsal", "NetBuster Grounds"
    };

    private static final String[][] VENUE_ADDRESSES = {
            { "Mirpur-10, Dhaka", "Mirpur" }, { "Gulshan-2, Dhaka", "Gulshan" },
            { "Dhanmondi-27, Dhaka", "Dhanmondi" }, { "Banani Block-F, Dhaka", "Banani" },
            { "Mohammadpur, Dhaka", "Mohammadpur" }, { "Uttara Sector 7, Dhaka", "Uttara" },
            { "Badda, Dhaka", "Badda" }, { "Rampura, Dhaka", "Rampura" },
            { "Wari, Dhaka", "Wari" }, { "Khilgaon, Dhaka", "Khilgaon" },
            { "Mirpur-1, Dhaka", "Mirpur" }, { "Gulshan-1, Dhaka", "Gulshan" },
            { "Dhanmondi-15, Dhaka", "Dhanmondi" }, { "Banani DOHS, Dhaka", "Banani" },
            { "Mohammadpur Housing, Dhaka", "Mohammadpur" }, { "Uttara Sector 10, Dhaka", "Uttara" },
            { "Badda Natun Bazar, Dhaka", "Badda" }, { "Rampura Bazar, Dhaka", "Rampura" },
            { "Wari Circular Rd, Dhaka", "Wari" }, { "Khilgaon Taltola, Dhaka", "Khilgaon" },
            { "Mirpur-12, Dhaka", "Mirpur" }, { "Gulshan Ave, Dhaka", "Gulshan" },
            { "Dhanmondi-32, Dhaka", "Dhanmondi" }, { "Banani Road 11, Dhaka", "Banani" },
            { "Mohammadpur Tajmahal, Dhaka", "Mohammadpur" }, { "Uttara Sector 4, Dhaka", "Uttara" },
            { "Badda BSCIC, Dhaka", "Badda" }, { "Rampura TV Gate, Dhaka", "Rampura" },
            { "Wari Tipu Sultan, Dhaka", "Wari" }, { "Khilgaon Chowdhurypara, Dhaka", "Khilgaon" },
            { "Mirpur Ceramic Gate, Dhaka", "Mirpur" }, { "Gulshan Circle-1, Dhaka", "Gulshan" },
            { "Dhanmondi Lake Road, Dhaka", "Dhanmondi" }, { "Banani Road 17, Dhaka", "Banani" },
            { "Mohammadpur Central, Dhaka", "Mohammadpur" }, { "Uttara Sector 13, Dhaka", "Uttara" },
            { "Badda Link Rd, Dhaka", "Badda" }, { "Rampura Malibagh, Dhaka", "Rampura" },
            { "Wari Narinda, Dhaka", "Wari" }, { "Khilgaon Rail Gate, Dhaka", "Khilgaon" },
    };

    private static final double[][] VENUE_COORDS = {
            { 23.8041, 90.3653 }, { 23.7805, 90.4150 }, { 23.7461, 90.3742 }, { 23.7937, 90.4012 },
            { 23.7640, 90.3572 }, { 23.8759, 90.3995 }, { 23.7750, 90.4220 }, { 23.7672, 90.4261 },
            { 23.7180, 90.4094 }, { 23.7559, 90.4354 }, { 23.8050, 90.3700 }, { 23.7820, 90.4120 },
            { 23.7480, 90.3800 }, { 23.7960, 90.4050 }, { 23.7650, 90.3600 }, { 23.8780, 90.4010 },
            { 23.7760, 90.4230 }, { 23.7680, 90.4270 }, { 23.7190, 90.4100 }, { 23.7570, 90.4360 },
            { 23.8060, 90.3680 }, { 23.7830, 90.4140 }, { 23.7490, 90.3780 }, { 23.7970, 90.4060 },
            { 23.7660, 90.3590 }, { 23.8770, 90.4000 }, { 23.7770, 90.4240 }, { 23.7690, 90.4280 },
            { 23.7200, 90.4110 }, { 23.7580, 90.4370 }, { 23.8070, 90.3710 }, { 23.7840, 90.4160 },
            { 23.7500, 90.3760 }, { 23.7980, 90.4080 }, { 23.7670, 90.3580 }, { 23.8760, 90.3990 },
            { 23.7780, 90.4250 }, { 23.7700, 90.4290 }, { 23.7210, 90.4120 }, { 23.7590, 90.4380 },
    };

    private static final String[] VENUE_STATUSES = {
            "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", // 32 LIVE
            "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE",
            "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE",
            "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE", "LIVE",
            "SUSPENDED", "SUSPENDED", "SUSPENDED", "SUSPENDED", "SUSPENDED", // 5 SUSPENDED
            "DRAFT", "DRAFT", "DRAFT" // 3 DRAFT
    };

    // ── Boot trigger ──────────────────────────────────────────────────────

    @Override
    @Transactional
    public void run(String... args) {
        seed(false);
    }

    @Transactional
    public void seed(boolean force) {
        if (!force && userRepository.count() >= 50) {
            log.info("[Seeder] Database already populated ({} users) — skipping demo data seeding.",
                    userRepository.count());
            return;
        }
        log.info("[Seeder] Starting demo data seed...");
        List<User> users = seedUsers();
        seedVenuesAndRequests(users);
        log.info("[Seeder] Part A complete: {} users, {} venues, {} turf requests",
                userRepository.count(), venueRepository.count(), turfRequestRepository.count());
    }

    // ── A1: Seed Users ────────────────────────────────────────────────────

    private List<User> seedUsers() {
        List<User> allUsers = new ArrayList<>();
        String hash = passwordEncoder.encode("TurfChai@123");

        // Monthly distribution: spread createdAt across past 6 months
        // month offsets (0 = current month), counts per month
        int[][] monthlyPlan = {
                // {monthsAgo, players, soloPlayers, hosts, owners}
                { 5, 55, 5, 5, 2 },
                { 4, 75, 10, 8, 3 },
                { 3, 100, 12, 9, 4 },
                { 2, 120, 15, 10, 5 },
                { 1, 150, 20, 10, 5 },
                { 0, 120, 18, 8, 6 },
        };

        int emailIndex = 0;

        for (int[] plan : monthlyPlan) {
            int monthsAgo = plan[0];
            int players = plan[1];
            int soloPlayers = plan[2];
            int hosts = plan[3];
            int owners = plan[4];

            // PLAYER
            for (int i = 0; i < players; i++) {
                allUsers.add(buildUser(emailIndex++, RoleType.PLAYER, "ACTIVE", monthsAgo, hash));
            }
            // SOLO_PLAYER
            for (int i = 0; i < soloPlayers; i++) {
                allUsers.add(buildUser(emailIndex++, RoleType.SOLO_PLAYER, "ACTIVE", monthsAgo, hash));
            }
            // HOST
            for (int i = 0; i < hosts; i++) {
                allUsers.add(buildUser(emailIndex++, RoleType.HOST, "ACTIVE", monthsAgo, hash));
            }
            // OWNER
            for (int i = 0; i < owners; i++) {
                allUsers.add(buildUser(emailIndex++, RoleType.OWNER, "ACTIVE", monthsAgo, hash));
            }
        }

        // Sprinkle some INACTIVE/SUSPENDED players across all months
        for (int i = 0; i < 60; i++) {
            User u = buildUser(emailIndex++, RoleType.PLAYER, i % 2 == 0 ? "INACTIVE" : "ACTIVE", RNG.nextInt(6), hash);
            u.setIsSuspended(i % 3 == 0);
            u.setReliabilityScore(RNG.nextInt(60));
            u.setGamesNoShow(RNG.nextInt(5) + 1);
            allUsers.add(u);
        }

        // 4 ADMINs (Super Admin is managed by AdminDataSeeder)
        String[] adminNames = { "Nadia Amin", "Farid Hasan", "Arman Habib", "Riya Sarkar" };
        for (int i = 0; i < 4; i++) {
            allUsers.add(User.builder()
                    .fullName(adminNames[i])
                    .email("admin" + i + "@turfchai.com")
                    .phone("+8801800000" + String.format("%02d", i + 10))
                    .passwordHash(hash)
                    .role(RoleType.ADMIN)
                    .status("ACTIVE")
                    .area("Gulshan")
                    .avatarInitials(initials(adminNames[i]))
                    .reliabilityScore(100)
                    .createdAt(OffsetDateTime.now().minusMonths(6).minusDays(RNG.nextInt(10)))
                    .updatedAt(OffsetDateTime.now())
                    .build());
        }

        userRepository.saveAll(allUsers);
        log.info("[Seeder] Saved {} users", allUsers.size());
        return allUsers;
    }

    private User buildUser(int index, RoleType role, String status, int monthsAgo, String hash) {
        String firstName = FIRST_NAMES[index % FIRST_NAMES.length];
        String lastName = LAST_NAMES[(index / FIRST_NAMES.length) % LAST_NAMES.length];
        // Ensure uniqueness by appending the index
        String fullName = firstName + " " + lastName;
        String email = firstName.toLowerCase() + "." + lastName.toLowerCase() + "." + index + "@gmail.com";
        String phone = "+88015" + String.format("%08d", index + 10000);
        String area = AREAS[index % AREAS.length];

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime createdAt = now.minusMonths(monthsAgo)
                .minusDays(RNG.nextInt(28))
                .minusHours(RNG.nextInt(24));

        SkillLevel[] skills = SkillLevel.values();

        return User.builder()
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .passwordHash(hash)
                .role(role)
                .status(status)
                .area(area)
                .signupChannel(SIGNUP_CHANNELS[index % SIGNUP_CHANNELS.length])
                .avatarInitials(initials(fullName))
                .bio("Playing football since " + (2010 + RNG.nextInt(14)))
                .reliabilityScore(60 + RNG.nextInt(41))
                .gamesAttended(RNG.nextInt(120))
                .gamesNoShow(RNG.nextInt(3))
                .playStyle(skills[RNG.nextInt(skills.length)])
                .preferredSports("football,cricket")
                .preferredTimes("evening,weekend")
                .createdAt(createdAt)
                .updatedAt(createdAt.plusDays(RNG.nextInt(30)))
                .build();
    }

    // ── A2: Seed Venues + TurfRequests ───────────────────────────────────

    private void seedVenuesAndRequests(List<User> users) {
        // Collect owners from the user list
        List<User> owners = users.stream()
                .filter(u -> u.getRole() == RoleType.OWNER || u.getRole() == RoleType.HOST)
                .toList();

        List<Venue> venues = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            User owner = owners.get(i % owners.size());
            String[] addressArea = VENUE_ADDRESSES[i];
            double[] coords = VENUE_COORDS[i];
            String status = VENUE_STATUSES[i];
            String venueName = VENUE_NAMES[i];
            String baseSlug = venueName.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
            String slug = baseSlug + "-demo-" + (i + 1);
            String venueCode = "VD-" + String.format("%04d", 1000 + i);

            Venue venue = Venue.builder()
                    .name(venueName)
                    .slug(slug)
                    .venueCode(venueCode)
                    .owner(owner)
                    .status(status)
                    .address(addressArea[0])
                    .area(addressArea[1])
                    .lat(BigDecimal.valueOf(coords[0]))
                    .lng(BigDecimal.valueOf(coords[1]))
                    // Rating and review count are NOT seeded: they are derived
                    // from real review rows by ReviewService.recalculateVenueRating.
                    // Inventing them here made venues advertise "167 reviews"
                    // above a reviews tab that showed none.
                    .savedCount(5 + RNG.nextInt(150))
                    .verified(i < 28) // first 28 venues are verified
                    .tournamentReady(i % 5 == 0)
                    .hasPromotion(i % 7 == 0)
                    .promotionLabel(i % 7 == 0 ? "Buy 5 get 1 free" : null)
                    .photos(VENUE_PHOTO_URLS[i % VENUE_PHOTO_URLS.length] + "," + VENUE_PHOTO_URLS[(i + 1) % VENUE_PHOTO_URLS.length])
                    .amenities("floodlights,parking,changing_room,water,first_aid")
                    .openTime(LocalTime.of(6, 0))
                    .closeTime(LocalTime.of(23, 0))
                    .depositPolicy("FULL_ONLY")
                    .cancelPolicy("FREE_24H_50_6H")
                    .contactPhone("+88017" + String.format("%08d", 10000000 + i))
                    .contactEmail("venue" + i + "@turfchai.com")
                    .createdAt(Instant.now().minusSeconds((long) (RNG.nextInt(180) * 86400)))
                    .updatedAt(Instant.now())
                    .build();

            // Add 2–3 pitches per venue
            int pitchCount = 2 + (i % 2);
            String[] formats = { "5_a_side", "7_a_side", "11_a_side" };
            for (int p = 0; p < pitchCount; p++) {
                Pitch pitch = new Pitch();
                pitch.setName("Pitch " + (char) ('A' + p));
                pitch.setFormat(formats[p % formats.length]);
                pitch.setSurfaceType("Artificial Grass");
                pitch.setSurfaceDetail("3rd generation synthetic turf");
                pitch.setDimensions("30×50 m");
                pitch.setLighting("Full LED floodlights");
                pitch.setMaxPlayers(p == 0 ? 10 : 14);
                pitch.setIndoor(false);
                pitch.setActive(true);
                venue.addPitch(pitch);
            }

            venues.add(venue);
        }
        venueRepository.saveAll(venues);
        log.info("[Seeder] Saved {} venues", venues.size());

        // Seed TurfRequests
        seedTurfRequests(owners, venues);
    }

    private void seedTurfRequests(List<User> owners, List<Venue> venues) {
        List<TurfRequest> requests = new ArrayList<>();
        String[] statuses = { "PENDING", "PENDING", "PENDING", "PENDING", "PENDING", "PENDING",
                "APPROVED", "APPROVED", "REJECTED", "REJECTED" };
        String[] venueNames = {
                "Sunrise Futsal Hub", "Delta Pitch Zone", "Metro Arena Mirpur",
                "Urban Kick Complex", "Skyfield Sports", "BlazeField Dhaka",
                "TurfZone Uttara", "Sprint Kick Arena", "Neptune Grounds", "Atlas Futsal Hub"
        };
        String[] areas = { "Mirpur", "Gulshan", "Dhanmondi", "Banani", "Mohammadpur",
                "Uttara", "Badda", "Rampura", "Wari", "Khilgaon" };

        for (int i = 0; i < 10; i++) {
            User owner = owners.get((i + 3) % owners.size());
            String status = statuses[i];
            OffsetDateTime createdAt = OffsetDateTime.now().minusDays(RNG.nextInt(60) + 1);

            TurfRequest req = TurfRequest.builder()
                    .requestCode("TR-" + String.format("%04d", 1050 + i))
                    .ownerUserId(owner.getId())
                    .venueId(i < venues.size() ? venues.get(i).getId() : null)
                    .venueName(venueNames[i])
                    .area(areas[i])
                    .pitchCount(2 + RNG.nextInt(3))
                    .sportsCsv("football,cricket")
                    .ownerPhone(owner.getPhone())
                    .ownerEmail(owner.getEmail())
                    .docTradeLicense(status.equals("PENDING") ? "PENDING" : "VERIFIED")
                    .docOwnerNid(status.equals("PENDING") ? "PENDING" : "VERIFIED")
                    .docUtilityBill(status.equals("PENDING") ? "PENDING" : "VERIFIED")
                    .status(status)
                    .adminNote(status.equals("REJECTED") ? "Incomplete documentation submitted." : null)
                    .createdAt(createdAt)
                    .updatedAt(createdAt.plusDays(status.equals("PENDING") ? 0 : RNG.nextInt(5)))
                    .build();
            requests.add(req);
        }
        turfRequestRepository.saveAll(requests);
        log.info("[Seeder] Saved {} turf requests", requests.size());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private String initials(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length >= 2) {
            return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
        }
        return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
    }
}
