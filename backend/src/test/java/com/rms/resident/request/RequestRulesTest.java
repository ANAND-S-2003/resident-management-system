package com.rms.resident.request;

import com.rms.resident.common.enums.RequestStatus;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import jakarta.validation.Validation;

class RequestRulesTest {
    @Test void transitionMatrixOnlyAllowsDocumentedEdges() {
        for(RequestStatus from:RequestStatus.values()) for(RequestStatus to:RequestStatus.values())
            assertEquals((from==RequestStatus.PENDING && (to==RequestStatus.IN_PROGRESS||to==RequestStatus.REJECTED))
                    ||(from==RequestStatus.IN_PROGRESS&&(to==RequestStatus.COMPLETED||to==RequestStatus.REJECTED)),
                    RequestTransitionPolicy.allows(from,to),from+" -> "+to);
    }
    @Test void overdueUsesStrictBeforeBoundaryAndOnlyOpenStates() {
        LocalDate today=LocalDate.of(2026,11,2);
        for(RequestStatus status:RequestStatus.values()) {
            assertEquals(status==RequestStatus.PENDING||status==RequestStatus.IN_PROGRESS,
                    OverdueRule.isOverdue(today.minusDays(1),status,today));
            assertFalse(OverdueRule.isOverdue(today,status,today));
            assertFalse(OverdueRule.isOverdue(today.plusDays(1),status,today));
        }
    }
    @Test void requestDatesUseClockZoneAndValidateExpectedDate() {
        ZoneId zone=ZoneId.of("Asia/Kolkata");
        Clock evening=Clock.fixed(Instant.parse("2026-11-01T20:00:00Z"),zone);
        Clock afternoon=Clock.fixed(Instant.parse("2026-11-01T17:00:00Z"),zone);
        LocalDate nov2=LocalDate.of(2026,11,2), nov1=LocalDate.of(2026,11,1);
        assertEquals(nov2,RequestDates.requestDate(evening)); assertEquals(nov1,RequestDates.requestDate(afternoon));
        assertFalse(RequestDates.expectedDateIsValid(nov2,nov1)); assertTrue(RequestDates.expectedDateIsValid(nov2,nov2));
    }
    @Test void createAndPatchDtosValidateRequiredFieldsAndCodePointLimits() {
        var validator=Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(new RequestDtos.Create(null,"abcd",null)).isEmpty());
        assertFalse(validator.validate(new RequestDtos.Create(1L,"",LocalDate.now())).isEmpty());
        assertTrue(validator.validate(new RequestDtos.Create(1L,"😀😀😀😀😀",LocalDate.now())).isEmpty());
        assertFalse(validator.validate(new RequestDtos.Create(1L,"😀".repeat(1001),LocalDate.now())).isEmpty());
        assertFalse(validator.validate(new RequestDtos.Update(null,null)).isEmpty());
        assertFalse(validator.validate(new RequestDtos.Update(null,"😀".repeat(1001))).isEmpty());
    }
}
