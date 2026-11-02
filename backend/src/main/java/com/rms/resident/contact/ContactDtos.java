package com.rms.resident.contact;

import com.rms.resident.common.validation.CodePointSize;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class ContactDtos {
    private ContactDtos() {}
    public record CreateRequest(
            @NotBlank @CodePointSize(min=2,max=120) String name,
            @NotBlank @Email @Size(max=254) @CodePointSize(max=254) String email,
            @NotBlank @CodePointSize(min=3,max=200) String subject,
            @NotBlank @CodePointSize(min=5,max=2000) String message) {
        public CreateRequest {
            name=trim(name); email=trim(email); subject=trim(subject); message=trim(message);
            if(email!=null) email=email.toLowerCase(java.util.Locale.ROOT);
        }
        private static String trim(String value){return value==null?null:value.trim();}
    }
    public record Created(Long id, Instant createdAt) {}
    public record Response(Long id, Long submittedById, String name, String email, String subject, String message, Instant createdAt) {}
}
