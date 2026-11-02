package com.rms.resident.common.error;

public class ApiException extends RuntimeException {
    private final ErrorCode errorCode;
    private final java.util.List<ApiErrorDetail> details;
    private final Long retryAfterSeconds;

    public ApiException(ErrorCode errorCode, String message) {
        this(errorCode, message, java.util.List.of(), null);
    }

    public ApiException(ErrorCode errorCode, String message, java.util.List<ApiErrorDetail> details) {
        this(errorCode, message, details, null);
    }

    public ApiException(ErrorCode errorCode, String message, long retryAfterSeconds) {
        this(errorCode, message, java.util.List.of(), retryAfterSeconds);
    }

    private ApiException(ErrorCode errorCode, String message, java.util.List<ApiErrorDetail> details, Long retryAfterSeconds) {
        super(message);
        this.errorCode = errorCode;
        this.details = java.util.List.copyOf(details);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public java.util.List<ApiErrorDetail> details() { return details; }
    public Long retryAfterSeconds() { return retryAfterSeconds; }
}
