package com.rms.resident.auth;

import java.time.Instant;

public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, LoginUserResponse user) {
    @Override
    public String toString() { return "LoginResponse[accessToken=[REDACTED], tokenType=" + tokenType + ", expiresAt=" + expiresAt + ", user=" + user + "]"; }
}
