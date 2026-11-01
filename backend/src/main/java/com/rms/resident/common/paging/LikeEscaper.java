package com.rms.resident.common.paging;

import java.util.Locale;

public final class LikeEscaper {
    private LikeEscaper() {}

    public static String escape(String value) {
        if (value == null) return null;
        return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    public static String containsPattern(String value) {
        if (value == null || value.isBlank()) return null;
        return "%" + escape(value.trim().toLowerCase(Locale.ROOT)) + "%";
    }
}
