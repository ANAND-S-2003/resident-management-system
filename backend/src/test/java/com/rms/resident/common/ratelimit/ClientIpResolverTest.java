package com.rms.resident.common.ratelimit;

import com.rms.resident.common.config.RmsProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClientIpResolverTest {
    @Test void usesSocketAddressWhenProxyIsNotTrusted() {
        HttpServletRequest request = request("198.51.100.8", "203.0.113.1, 203.0.113.2");
        assertThat(new ClientIpResolver(properties(false)).resolve(request)).isEqualTo("198.51.100.8");
    }

    @Test void ignoresForgedFirstAddressAndUsesNearestTrustedHop() {
        HttpServletRequest request = request("198.51.100.8", "192.0.2.99, 203.0.113.1, 203.0.113.2");
        assertThat(new ClientIpResolver(properties(true, 1)).resolve(request)).isEqualTo("203.0.113.2");
    }

    @Test void selectsAddressTwoHopsFromRightWhenConfigured() {
        HttpServletRequest request = request("198.51.100.8", "192.0.2.99, 203.0.113.1, 203.0.113.2");
        assertThat(new ClientIpResolver(properties(true, 2)).resolve(request)).isEqualTo("203.0.113.1");
    }

    @Test void clampsHopCountToAvailableForwardedAddresses() {
        HttpServletRequest request = request("198.51.100.8", "203.0.113.7");
        assertThat(new ClientIpResolver(properties(true, 2)).resolve(request)).isEqualTo("203.0.113.7");
    }

    @Test void fallsBackToSocketWhenForwardedHeaderIsMissingOrBlank() {
        assertThat(new ClientIpResolver(properties(true, 1)).resolve(request("198.51.100.8", null)))
                .isEqualTo("198.51.100.8");
        assertThat(new ClientIpResolver(properties(true, 1)).resolve(request("198.51.100.8", " , ")))
                .isEqualTo("198.51.100.8");
    }

    private static HttpServletRequest request(String remote, String forwarded) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn(remote);
        when(request.getHeader("X-Forwarded-For")).thenReturn(forwarded);
        return request;
    }

    private static RmsProperties properties(boolean trustProxy) {
        return properties(trustProxy, 1);
    }

    private static RmsProperties properties(boolean trustProxy, int trustedProxyHops) {
        return new RmsProperties("01234567890123456789012345678901", "root@example.test",
                "Test Super Admin", "TestPassword123", "Asia/Kolkata", List.of(), trustProxy, 5, 10, 5, 5,
                trustedProxyHops);
    }
}
