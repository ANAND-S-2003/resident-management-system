package com.rms.resident.common.paging;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class LikeEscaperTest {
    @Test void escapesSqlLikeWildcardsAndEscapeCharacter() {
        assertThat(LikeEscaper.escape("A%_\\B")).isEqualTo("A\\%\\_\\\\B");
    }
}
