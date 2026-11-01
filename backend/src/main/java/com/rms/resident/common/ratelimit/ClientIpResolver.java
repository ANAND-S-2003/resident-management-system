package com.rms.resident.common.ratelimit;

import com.rms.resident.common.config.RmsProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class ClientIpResolver {
    private final boolean trustProxy;

    public ClientIpResolver(RmsProperties properties) {
        this.trustProxy = properties.trustProxy();
    }

    public String resolve(HttpServletRequest request) {
        if (trustProxy) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                String first = forwardedFor.split(",", 2)[0].trim();
                if (!first.isEmpty()) return first;
            }
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
