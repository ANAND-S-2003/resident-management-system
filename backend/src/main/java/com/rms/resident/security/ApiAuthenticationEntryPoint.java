package com.rms.resident.security;

import com.rms.resident.common.error.ErrorCode;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {
    private final SecurityErrorWriter errorWriter;

    public ApiAuthenticationEntryPoint(SecurityErrorWriter errorWriter) { this.errorWriter = errorWriter; }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException, ServletException {
        errorWriter.write(request, response, ErrorCode.UNAUTHENTICATED, "Authentication is required or the token is invalid");
    }
}
