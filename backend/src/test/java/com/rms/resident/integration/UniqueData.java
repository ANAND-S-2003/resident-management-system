package com.rms.resident.integration;

import java.util.UUID;

/** Produces collision-resistant tokens for values searched across the shared integration database. */
public final class UniqueData {
    private UniqueData() {}

    public static String token() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
