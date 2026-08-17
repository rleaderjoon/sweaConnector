package app.sweaconnector.reader

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 동기 로드. 파싱은 실행 시 한 번뿐이고 화면 전환에는 아무 비용이 없다.
        // 로딩 상태 자체를 없애는 것이 "누르자마자 뜬다"의 전제.
        val content = assets.open("content.json").use { input ->
            json.decodeFromString<Content>(input.readBytes().decodeToString())
        }

        setContent { App(content) }
    }
}

@Composable
fun App(content: Content) {
    var tab by rememberSaveable { mutableStateOf(Tab.Problems) }
    var problemKey by rememberSaveable { mutableStateOf<String?>(null) }
    var conceptId by rememberSaveable { mutableStateOf<String?>(null) }

    val selection = if (tab == Tab.Problems) problemKey else conceptId
    val clearSelection: () -> Unit = {
        if (tab == Tab.Problems) problemKey = null else conceptId = null
    }

    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .background(Ink.Paper)
            .windowInsetsPadding(WindowInsets.systemBars)
    ) {
        // 펼치면 책 펼친 면(목차 + 본문), 접으면 한 페이지.
        // 힌지 API 대신 폭으로 판정한다 — 세로/가로 회전까지 같은 규칙 하나로 덮인다.
        val twoPane = maxWidth >= TwoPaneWidth
        val paneWidth = listPaneWidth(maxWidth)

        BackHandler(enabled = !twoPane && selection != null, onBack = clearSelection)

        Column(Modifier.fillMaxSize()) {
            TextTabs(
                tab = tab,
                onTab = { tab = it },
                back = if (!twoPane && selection != null) clearSelection else null,
            )

            if (twoPane) {
                Row(Modifier.fillMaxSize()) {
                    Column(Modifier.width(paneWidth).fillMaxHeight()) {
                        ListPane(content, tab, problemKey, conceptId, { problemKey = it }, { conceptId = it })
                    }
                    VerticalHairline()
                    Column(Modifier.weight(1f).fillMaxHeight()) {
                        DetailPane(content, tab, problemKey, conceptId)
                    }
                }
            } else if (selection == null) {
                ListPane(content, tab, problemKey, conceptId, { problemKey = it }, { conceptId = it })
            } else {
                DetailPane(content, tab, problemKey, conceptId)
            }
        }
    }
}

@Composable
private fun ListPane(
    content: Content,
    tab: Tab,
    problemKey: String?,
    conceptId: String?,
    onProblem: (String) -> Unit,
    onConcept: (String) -> Unit,
) {
    when (tab) {
        Tab.Problems -> ContentsPane(content, problemKey, onProblem)
        Tab.Concepts -> ConceptsPane(content, conceptId, onConcept)
    }
}

@Composable
private fun DetailPane(content: Content, tab: Tab, problemKey: String?, conceptId: String?) {
    when (tab) {
        Tab.Problems -> {
            val p = content.problems.firstOrNull { it.key == problemKey }
            if (p != null) ProblemPane(p, content.diagrams) else EmptyPane("왼쪽에서 문제를 고르세요")
        }

        Tab.Concepts -> {
            val c = content.concepts.firstOrNull { it.id == conceptId }
            if (c != null) ConceptPane(c, content.diagrams) else EmptyPane("왼쪽에서 개념을 고르세요")
        }
    }
}
