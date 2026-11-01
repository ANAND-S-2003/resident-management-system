package com.rms.resident.common.paging;

public final class LikeEscaper {
    private LikeEscaper() {}

    public static String escape(String value) {
        if (value == null) return null;
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
