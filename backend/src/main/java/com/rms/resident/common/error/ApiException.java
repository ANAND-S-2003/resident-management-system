package com.rms.resident.common.error;

public class ApiException extends RuntimeException {
    private final ErrorCode errorCode;
    private final java.util.List<ApiErrorDetail> details;

    public ApiException(ErrorCode errorCode, String message) {
        this(errorCode, message, java.util.List.of());
    }

    public ApiException(ErrorCode errorCode, String message, java.util.List<ApiErrorDetail> details) {
        super(message);
        this.errorCode = errorCode;
        this.details = java.util.List.copyOf(details);
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public java.util.List<ApiErrorDetail> details() { return details; }
}
