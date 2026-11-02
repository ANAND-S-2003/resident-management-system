package com.rms.resident.request;

import java.time.Clock;
import java.time.LocalDate;

public final class RequestDates {
    private RequestDates() {}
    public static LocalDate requestDate(Clock clock) { return LocalDate.now(clock); }
    public static boolean expectedDateIsValid(LocalDate requestDate, LocalDate expectedDate) {
        return expectedDate != null && !expectedDate.isBefore(requestDate);
    }
}
