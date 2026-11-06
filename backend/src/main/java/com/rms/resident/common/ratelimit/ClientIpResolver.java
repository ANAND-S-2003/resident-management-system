package com.rms.resident.common.ratelimit;

import com.rms.resident.common.config.RmsProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class ClientIpResolver {
    private final boolean trustProxy;
    private final int trustedProxyHops;

    public ClientIpResolver(RmsProperties properties) {
        this.trustProxy = properties.trustProxy();
        this.trustedProxyHops = properties.trustedProxyHops();
    }

    public String resolve(HttpServletRequest request) {
        if (trustProxy) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                String[] addresses = forwardedFor.split(",", -1);
                int selectedIndex = Math.max(0, addresses.length - trustedProxyHops);
                String selected = addresses[selectedIndex].trim();
                if (!selected.isEmpty()) return selected;
            }
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
