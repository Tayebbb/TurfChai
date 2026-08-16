package com.turfchai.ai.tool.impl;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolArgs;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.tournament.service.TournamentService;
import com.turfchai.tournament.service.TournamentViews.TournamentCard;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Live tournament discovery, backed by the same
 * {@link TournamentService#browse} the player tournament feed uses.
 *
 * <p>
 * The viewer is resolved from the verified principal so the card can carry
 * "you are already registered" — for an anonymous visitor it is simply null,
 * which the card mapper already handles.
 */
@Component
public class TournamentTool implements Tool {

    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 12;

    private final TournamentService tournamentService;
    private final UserRepository userRepository;

    public TournamentTool(TournamentService tournamentService, UserRepository userRepository) {
        this.tournamentService = tournamentService;
        this.userRepository = userRepository;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "search_tournaments",
                "List real upcoming tournaments open for registration: entry fee, prize pool, format, venue, date and "
                        + "remaining team spots. Set mine=true to list only the ones the signed-in user has entered.",
                List.of(
                        ToolParam.optional("format", "string",
                                "Format filter, e.g. KNOCKOUT, LEAGUE — matched case-insensitively"),
                        ToolParam.optional("mine", "boolean", "true to list only the user's own registrations"),
                        ToolParam.optional("limit", "integer", "How many to return, 1-12 (default 5)")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        User viewer = context.isAuthenticated()
                ? userRepository.findById(context.authenticatedUserId()).orElse(null)
                : null;

        boolean mineOnly = Boolean.parseBoolean(String.valueOf(arguments.get("mine")));
        if (mineOnly && viewer == null) {
            return ToolResult.fail("The user is not signed in, so their registrations cannot be read. "
                    + "Ask them to sign in at /auth.");
        }

        int limit = ToolArgs.bounded(ToolArgs.integer(arguments, "limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
        String format = ToolArgs.string(arguments, "format");

        List<TournamentCard> cards = mineOnly
                ? tournamentService.myTournaments(viewer)
                : tournamentService.browse(true, true, viewer, 0, limit).items();

        List<Map<String, Object>> rows = cards.stream()
                .filter(card -> format == null || format.equalsIgnoreCase(card.format()))
                .limit(limit)
                .map(TournamentTool::toRow)
                .toList();

        Map<String, Object> body = ToolArgs.row();
        body.put("count", rows.size());
        body.put("tournaments", rows);
        if (rows.isEmpty()) {
            body.put("note", mineOnly
                    ? "This user has not registered for any tournament."
                    : "No tournament is currently open for registration.");
        }
        return ToolResult.ok(body);
    }

    private static Map<String, Object> toRow(TournamentCard card) {
        Map<String, Object> row = ToolArgs.row();
        ToolArgs.put(row, "code", card.code());
        ToolArgs.put(row, "name", card.name());
        ToolArgs.put(row, "venue", card.venueName());
        ToolArgs.put(row, "date", card.date());
        ToolArgs.put(row, "windowStart", card.windowStart());
        ToolArgs.put(row, "windowEnd", card.windowEnd());
        ToolArgs.put(row, "format", card.format());
        ToolArgs.put(row, "privacy", card.privacy());
        ToolArgs.put(row, "status", card.status());
        row.put("teamCapacity", card.teamCapacity());
        row.put("registeredTeams", card.registeredTeams());
        row.put("spotsLeft", card.spotsLeft());
        ToolArgs.put(row, "entryFeePerTeamBdt", card.entryFeePerTeam());
        ToolArgs.put(row, "prizePoolBdt", card.prizePool());
        ToolArgs.put(row, "myRegistrationCode", card.myRegistrationCode());
        ToolArgs.put(row, "myEntryFeeStatus", card.myPaymentStatus());
        ToolArgs.put(row, "detailsAt", "/player/tournaments/" + card.code());
        return row;
    }
}
