package com.rms.resident.common.error;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final Clock clock;

    public GlobalExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        ResponseEntity<ApiErrorResponse> response = response(ex.errorCode(), ex.getMessage(), request, ex.details());
        if (ex.retryAfterSeconds() != null) {
            return ResponseEntity.status(ex.errorCode().httpStatus()).header("Retry-After", ex.retryAfterSeconds().toString())
                    .body(response.getBody());
        }
        return response;
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiErrorResponse> handleAccessDenied(HttpServletRequest request) {
        return response(ErrorCode.FORBIDDEN, "You do not have permission to access this resource", request, List.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ApiErrorResponse> handleAuthenticationFailure(HttpServletRequest request) {
        return response(ErrorCode.UNAUTHENTICATED, "Authentication is required or the token is invalid", request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleBodyValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        return validation(ex.getBindingResult().getFieldErrors(), request);
    }

    @ExceptionHandler(BindException.class)
    ResponseEntity<ApiErrorResponse> handleBinding(BindException ex, HttpServletRequest request) {
        return validation(ex.getBindingResult().getFieldErrors(), request);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiErrorResponse> handleMethodValidation(HandlerMethodValidationException ex, HttpServletRequest request) {
        List<ApiErrorDetail> details = ex.getAllValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream().map(error -> new ApiErrorDetail(
                        result.getMethodParameter().getParameterName() == null ? "parameter" : result.getMethodParameter().getParameterName(),
                        error.getDefaultMessage() == null ? "Invalid value" : error.getDefaultMessage())))
                .sorted(Comparator.comparing(ApiErrorDetail::field)).toList();
        return response(ErrorCode.VALIDATION_ERROR, "Request validation failed", request, details);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        List<ApiErrorDetail> details = ex.getConstraintViolations().stream()
                .map(v -> new ApiErrorDetail(v.getPropertyPath().toString(), v.getMessage()))
                .sorted(Comparator.comparing(ApiErrorDetail::field)).toList();
        return response(ErrorCode.VALIDATION_ERROR, "Request validation failed", request, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleUnreadableJson(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return response(ErrorCode.VALIDATION_ERROR, "Malformed or unreadable JSON request body", request, List.of());
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    ResponseEntity<ApiErrorResponse> handleParameterError(Exception ex, HttpServletRequest request) {
        String field = ex instanceof MethodArgumentTypeMismatchException mismatch ? mismatch.getName()
                : ((MissingServletRequestParameterException) ex).getParameterName();
        return response(ErrorCode.VALIDATION_ERROR, "Request parameter is invalid", request,
                List.of(new ApiErrorDetail(field, "Invalid or missing value")));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return response(ErrorCode.METHOD_NOT_ALLOWED, "HTTP method is not supported for this path", request, List.of());
    }

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    ResponseEntity<ApiErrorResponse> handleNotFound(Exception ex, HttpServletRequest request) {
        return response(ErrorCode.NOT_FOUND, "Resource not found", request, List.of());
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, OptimisticLockException.class})
    ResponseEntity<ApiErrorResponse> handleOptimisticLock(Exception ex, HttpServletRequest request) {
        return response(ErrorCode.CONCURRENT_MODIFICATION, "The resource was modified by another request", request, List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled server exception", ex);
        return response(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred", request, List.of());
    }

    private ResponseEntity<ApiErrorResponse> validation(List<FieldError> errors, HttpServletRequest request) {
        List<ApiErrorDetail> details = errors.stream()
                .map(error -> new ApiErrorDetail(error.getField(), error.getDefaultMessage() == null ? "Invalid value" : error.getDefaultMessage()))
                .sorted(Comparator.comparing(ApiErrorDetail::field)).toList();
        return response(ErrorCode.VALIDATION_ERROR, "Request validation failed", request, details);
    }

    private ResponseEntity<ApiErrorResponse> response(ErrorCode code, String message, HttpServletRequest request,
                                                       List<ApiErrorDetail> details) {
        HttpStatus status = code.httpStatus();
        ApiErrorResponse body = new ApiErrorResponse(clock.instant(), status.value(), code.name(), message,
                request.getRequestURI(), details);
        return ResponseEntity.status(status).body(body);
    }
}
