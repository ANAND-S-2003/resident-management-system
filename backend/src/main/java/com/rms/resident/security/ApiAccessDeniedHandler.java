package com.rms.resident.security;

import com.rms.resident.common.error.ErrorCode;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {
    private final SecurityErrorWriter errorWriter;

    public ApiAccessDeniedHandler(SecurityErrorWriter errorWriter) { this.errorWriter = errorWriter; }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
            throws IOException, ServletException {
        errorWriter.write(request, response, ErrorCode.FORBIDDEN, "You do not have permission to access this resource");
    }
}
