package app.sweaconnector.reader

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.io.File

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val library = Library(Store(File(filesDir, "content")), Settings(this))

        // 로컬 사본을 동기로 읽는다. 인덱스 하나뿐이라 첫 프레임을 늦추지 않고,
        // 덕분에 시작 화면에 로딩 상태 자체가 없다. 원격은 그린 다음에 본다.
        library.loadCache()

        setContent { Root(library) }
    }
}

@Composable
private fun Root(library: Library) {
    var setup by rememberSaveable { mutableStateOf(!library.settings.configured) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Ink.Paper)
            .windowInsetsPadding(WindowInsets.systemBars)
    ) {
        when {
            setup -> SetupScreen(library) { setup = false }

            // 주소는 있는데 사본이 없다 — 처음 받는 중이거나, 받다 실패했다
            !library.ready -> FirstFetch(library, onSetup = { setup = true })

            else -> {
                App(library, onSetup = { setup = true })
                // 화면이 이미 떠 있는 상태에서 조용히 따라잡는다
                LaunchedEffect(Unit) { if (library.sync == Sync.Idle) library.refresh() }
            }
        }
    }
}

@Composable
private fun FirstFetch(library: Library, onSetup: () -> Unit) {
    LaunchedEffect(Unit) { if (library.sync == Sync.Idle) library.refresh() }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            when (val s = library.sync) {
                is Sync.Failed -> {
                    Text("가져오지 못했습니다", style = Type.Row.copy(color = Ink.Strong))
                    Spacer(Modifier.height(9.dp))
                    Text(s.message, style = Type.Meta)
                    Spacer(Modifier.height(Space.section))
                    Text("설정 고치기", style = Type.Tab, modifier = Modifier.clickable(onClick = onSetup))
                }

                else -> Text("받는 중…", style = Type.Row.copy(color = Ink.Faint))
            }
        }
    }
}

@Composable
private fun App(library: Library, onSetup: () -> Unit) {
    val index = library.index ?: return
    var tab by rememberSaveable { mutableStateOf(Tab.Problems) }
    var problemKey by rememberSaveable { mutableStateOf<String?>(null) }
    var conceptId by rememberSaveable { mutableStateOf<String?>(null) }

    val selection = if (tab == Tab.Problems) problemKey else conceptId
    val clearSelection: () -> Unit = {
        if (tab == Tab.Problems) problemKey = null else conceptId = null
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
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
                status = statusLine(library.sync),
                onStatus = onSetup,
            )

            if (twoPane) {
                Row(Modifier.fillMaxSize()) {
                    Column(Modifier.width(paneWidth).fillMaxHeight()) {
                        ListPane(index, tab, problemKey, conceptId, { problemKey = it }, { conceptId = it })
                    }
                    VerticalHairline()
                    Column(Modifier.weight(1f).fillMaxHeight()) {
                        DetailPane(library, index, tab, problemKey, conceptId)
                    }
                }
            } else if (selection == null) {
                ListPane(index, tab, problemKey, conceptId, { problemKey = it }, { conceptId = it })
            } else {
                DetailPane(library, index, tab, problemKey, conceptId)
            }
        }
    }
}

/** 평소에는 설정 입구, 무언가 오갈 때만 그 사실을 말한다. */
private fun statusLine(sync: Sync): String = when (sync) {
    is Sync.Running -> "갱신 중"
    is Sync.Done -> if (sync.changed > 0) "${sync.changed}개 갱신" else "설정"
    is Sync.Failed -> "연결 실패"
    Sync.Idle -> "설정"
}

@Composable
private fun ListPane(
    index: Index,
    tab: Tab,
    problemKey: String?,
    conceptId: String?,
    onProblem: (String) -> Unit,
    onConcept: (String) -> Unit,
) {
    when (tab) {
        Tab.Problems -> ContentsPane(index, problemKey, onProblem)
        Tab.Concepts -> ConceptsPane(index, conceptId, onConcept)
    }
}

@Composable
private fun DetailPane(library: Library, index: Index, tab: Tab, problemKey: String?, conceptId: String?) {
    when (tab) {
        Tab.Problems -> {
            val p = index.problems.firstOrNull { it.key == problemKey }
            // 본문은 눌린 조각 하나만 푼다. 그 조각이 갱신됐으면 해시가 바뀌었으니 다시 읽힌다.
            if (p != null) ProblemPane(p, library.problem(p.key), library.diagrams)
            else EmptyPane("왼쪽에서 문제를 고르세요")
        }

        Tab.Concepts -> {
            val c = index.concepts.firstOrNull { it.id == conceptId }
            if (c != null) ConceptPane(c, library.concept(c.id), library.diagrams)
            else EmptyPane("왼쪽에서 개념을 고르세요")
        }
    }
}
