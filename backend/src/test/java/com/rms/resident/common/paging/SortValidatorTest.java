package com.rms.resident.common.paging;

import com.rms.resident.common.error.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SortValidatorTest {
    private static final Set<String> FIELDS = Set.of("createdAt", "name");

    @Test
    void parsesValidSort() {
        SortValidator.SortSpec result = SortValidator.parse("name,asc", "createdAt,desc", FIELDS);
        assertThat(result.field()).isEqualTo("name");
        assertThat(result.direction()).isEqualTo(Sort.Direction.ASC);
    }

    @Test
    void usesDefaultWhenSortIsMissing() {
        SortValidator.SortSpec result = SortValidator.parse(null, "createdAt,desc", FIELDS);
        assertThat(result.field()).isEqualTo("createdAt");
        assertThat(result.direction()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    void rejectsUnknownFields() {
        assertThatThrownBy(() -> SortValidator.parse("password,asc", "createdAt,desc", FIELDS))
                .isInstanceOf(ApiException.class)
                .hasMessage("Unsupported sort field");
    }

    @Test
    void rejectsMalformedValues() {
        assertThatThrownBy(() -> SortValidator.parse("name", "createdAt,desc", FIELDS))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("field,asc or field,desc");
        assertThatThrownBy(() -> SortValidator.parse("name,up", "createdAt,desc", FIELDS))
                .isInstanceOf(ApiException.class)
                .hasMessage("Sort direction must be asc or desc");
    }

    @Test
    void clampsPageSizeToDocumentedBounds() {
        assertThat(SortValidator.clampSize(null)).isEqualTo(20);
        assertThat(SortValidator.clampSize(200)).isEqualTo(100);
        assertThat(SortValidator.clampSize(0)).isEqualTo(1);
    }

    @Test
    void acceptsEveryDocumentedUserSortFieldIncludingRoleAndRejectsUnknownField() {
        Set<String> userFields = Set.of("createdAt", "fullName", "email", "role");
        for (String field : userFields) {
            assertThat(SortValidator.parse(field + ",asc", "createdAt,desc", userFields).field()).isEqualTo(field);
        }
        assertThatThrownBy(() -> SortValidator.parse("unknown,asc", "createdAt,desc", userFields))
                .isInstanceOf(ApiException.class)
                .hasMessage("Unsupported sort field");
    }
}
