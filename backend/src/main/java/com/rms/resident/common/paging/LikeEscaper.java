package com.rms.resident.common.paging;

import java.util.Locale;

public final class LikeEscaper {
    public static final char ESCAPE_CHARACTER = '!';

    private LikeEscaper() {}

    public static String escape(String value) {
        if (value == null) return null;
        return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    public static LikePattern containsPattern(String value) {
        if (value == null || value.isBlank()) return null;
        return new LikePattern("%" + escape(value.trim().toLowerCase(Locale.ROOT)) + "%", ESCAPE_CHARACTER);
    }

    public record LikePattern(String value, char escapeCharacter) {}
}
