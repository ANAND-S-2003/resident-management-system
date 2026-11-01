package com.rms.resident.common.paging;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class LikeEscaperTest {
    @Test void escapesSqlLikeWildcardsAndEscapeCharacter() {
        assertThat(LikeEscaper.escape("A%_!B")).isEqualTo("A!%!_!!B");
    }
    @Test void leavesOrdinaryTextAloneAndBuildsTrimmedCaseInsensitiveContainsPattern() {
        assertThat(LikeEscaper.escape("ordinary text")).isEqualTo("ordinary text");
        assertPattern("  x  ", "%x%");
        assertPattern("ordinary", "%ordinary%");
    }
    @Test void nullEmptyAndBlankQueriesMeanNoFilter() {
        assertThat(LikeEscaper.containsPattern(null)).isNull();
        assertThat(LikeEscaper.containsPattern("")).isNull();
        assertThat(LikeEscaper.containsPattern("   ")).isNull();
    }
    @Test void exactPatternsAndEscapeCharacterArePassedThroughAsOneValue() {
        assertPattern("%", "%!%%");
        assertPattern("_", "%!_%");
        assertPattern("!", "%!!%");
        assertPattern("50%", "%50!%%");
        assertPattern("a_b", "%a!_b%");
    }

    private static void assertPattern(String raw, String expected) {
        LikeEscaper.LikePattern pattern = LikeEscaper.containsPattern(raw);
        assertThat(pattern.value()).isEqualTo(expected);
        assertThat(pattern.escapeCharacter()).isEqualTo('!');
    }
}
