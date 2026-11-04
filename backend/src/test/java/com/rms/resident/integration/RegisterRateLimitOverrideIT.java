package com.rms.resident.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class RegisterRateLimitOverrideIT {
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        SharedMySqlContainer.registerProperties(registry);
        registry.add("rms.rate-limit-register-max", () -> "2");
    }

    @Autowired MockMvc mvc;

    @Test
    void configuredMaximumAllowsTwoAttemptsAndLimitsTheThird() throws Exception {
        String ip = "203.0.113.82";
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(register(ip)).andExpect(status().isCreated());
        }
        mvc.perform(register(ip))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder register(String ip) {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String body = "{\"fullName\":\"Rate Limit Resident\",\"email\":\"rate-" + suffix
                + "@example.test\",\"password\":\"Resident123\",\"flatNumber\":\"RL-1\"}";
        return post("/api/v1/auth/register").with(remoteAddr(ip)).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static RequestPostProcessor remoteAddr(String ip) {
        return request -> { request.setRemoteAddr(ip); return request; };
    }
}
