package com.rms.resident.common.paging;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class LikeEscaperTest {
    @Test void escapesSqlLikeWildcardsAndEscapeCharacter() {
        assertThat(LikeEscaper.escape("A%_!B")).isEqualTo("A!%!_!!B");
    }
    @Test void leavesOrdinaryTextAloneAndBuildsTrimmedCaseInsensitiveContainsPattern() {
        assertThat(LikeEscaper.escape("ordinary text")).isEqualTo("ordinary text");
        assertThat(LikeEscaper.containsPattern("  Resident  ")).isEqualTo("%resident%");
    }
    @Test void nullEmptyAndBlankQueriesMeanNoFilter() {
        assertThat(LikeEscaper.containsPattern(null)).isNull();
        assertThat(LikeEscaper.containsPattern("")).isNull();
        assertThat(LikeEscaper.containsPattern("   ")).isNull();
    }
}
