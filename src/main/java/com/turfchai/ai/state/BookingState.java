package com.turfchai.ai.state;

import java.util.StringJoiner;

/**
 * Structured, in-progress booking details for one conversation session.
 * This is application state — deliberately separate from chat history.
 */
public class BookingState {

    private String sport;
    private String area;
    private String venueId;
    private String venueName;
    private String date;
    private String time;
    private Integer players;
    private Integer budget;

    public String getSport() { return sport; }
    public void setSport(String sport) { this.sport = sport; }
    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }
    public String getVenueId() { return venueId; }
    public void setVenueId(String venueId) { this.venueId = venueId; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }
    public Integer getPlayers() { return players; }
    public void setPlayers(Integer players) { this.players = players; }
    public Integer getBudget() { return budget; }
    public void setBudget(Integer budget) { this.budget = budget; }

    public boolean isEmpty() {
        return sport == null && area == null && venueId == null && venueName == null
                && date == null && time == null && players == null && budget == null;
    }

    public boolean isReadyToBook() {
        return venueId != null && date != null && time != null;
    }

    /** Compact human-readable summary for prompt injection. */
    public String summary() {
        StringJoiner joiner = new StringJoiner(", ");
        if (sport != null) joiner.add("sport=" + sport);
        if (area != null) joiner.add("area=" + area);
        if (venueName != null) joiner.add("venue=" + venueName + (venueId != null ? " (" + venueId + ")" : ""));
        else if (venueId != null) joiner.add("venueId=" + venueId);
        if (date != null) joiner.add("date=" + date);
        if (time != null) joiner.add("time=" + time);
        if (players != null) joiner.add("players=" + players);
        if (budget != null) joiner.add("budget=৳" + budget);
        return joiner.toString();
    }
}
