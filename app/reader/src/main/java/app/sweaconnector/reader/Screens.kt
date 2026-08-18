package app.sweaconnector.reader

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// ─────────────────────────────────────────────── 목차

/**
 * 주차별 문제 목록. 위계를 색으로 만든다 —
 * 다 푼 것은 검고, 손댄 것은 굵고, 아직 안 푼 것은 연하다.
 */
@Composable
fun ContentsPane(index: Index, selectedKey: String?, onSelect: (String) -> Unit) {
    val byKey = index.problems.associateBy { it.key }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Column(Modifier.padding(horizontal = Space.page)) {
                Spacer(Modifier.height(8.dp))
                Text("${index.problems.count { it.status == "solved" }} / ${index.problems.size}", style = Type.Ghost)
                Spacer(Modifier.height(4.dp))
                Text("풀이 아카이브", style = Type.Title)
                index.config.examDate?.let {
                    Spacer(Modifier.height(7.dp))
                    Text("응시 $it", style = Type.Meta)
                }
                Spacer(Modifier.height(Space.section))
            }
        }

        for (week in index.weeks) {
            item(key = "w${week.week}") {
                Column {
                    Text(
                        "WEEK ${week.week}",
                        style = Type.Micro,
                        modifier = Modifier.padding(horizontal = Space.page, vertical = 11.dp),
                    )
                    Hairline()
                }
            }
            items(week.problems, key = { it }) { key ->
                byKey[key]?.let { ProblemRow(it, key == selectedKey) { onSelect(key) } }
            }
            item(key = "gap${week.week}") { Spacer(Modifier.height(Space.section)) }
        }

        item { Spacer(Modifier.height(40.dp)) }
    }
}

@Composable
private fun ProblemRow(p: ProblemMeta, selected: Boolean, onClick: () -> Unit) {
    // 상태가 그대로 굵기와 명도가 된다
    val color = when (p.status) {
        "solved" -> Ink.Strong
        "attempting" -> Ink.Strong
        "failed" -> Ink.Muted
        else -> Ink.Faint
    }
    val weight = if (p.status == "attempting") FontWeight.Bold else FontWeight.Medium

    Column(
        Modifier
            .fillMaxWidth()
            .background(if (selected) Ink.Wash else Ink.Paper)
            .clickable(onClick = onClick)
            .padding(horizontal = Space.page, vertical = Space.row)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = p.title,
                style = Type.Row.copy(color = color, fontWeight = weight),
                modifier = Modifier.weight(1f).padding(end = 12.dp),
            )
            p.difficulty?.let {
                Text(it, style = Type.Meta.copy(color = if (p.status == "todo") Ink.Faint else Ink.Muted))
            }
        }
        val meta = buildList {
            if (p.type == "pro") add("API 구현형")
            if (p.type == "drill") add("자체 훈련")
            addAll(p.topic)
            p.scheduledOn?.let { add(it.removePrefix("2026-")) }
        }
        if (meta.isNotEmpty()) {
            Spacer(Modifier.height(5.dp))
            Text(
                meta.joinToString("  ·  "),
                style = Type.Meta.copy(color = if (p.status == "todo") Ink.Faint else Ink.Muted),
            )
        }
    }
    Hairline()
}

// ─────────────────────────────────────────────── 문제 상세

@Composable
fun ProblemPane(p: ProblemMeta, body: ProblemBody?, diagrams: Map<String, Diagram>) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Space.page)
    ) {
        Spacer(Modifier.height(8.dp))
        Text(p.problemId?.toString() ?: "W${p.week}", style = Type.Ghost)
        Spacer(Modifier.height(4.dp))
        Text(p.title, style = Type.Title)

        Spacer(Modifier.height(11.dp))
        Text(
            buildList {
                add(statusLabel(p.status))
                p.difficulty?.let { add(it) }
                if (p.type == "pro") add("API 구현형")
                addAll(p.topic)
                p.timeSpentMin?.let { add("${it}분") }
                p.source?.let { add(it) }
            }.joinToString("  ·  "),
            style = Type.Micro,
        )

        Spacer(Modifier.height(20.dp))
        Hairline()
        Spacer(Modifier.height(Space.block))

        p.diagram?.let { id ->
            diagrams[id]?.let {
                DiagramView(it, Modifier.fillMaxWidth())
                Spacer(Modifier.height(Space.section))
            }
        }

        if (body == null) {
            Text("본문을 아직 받지 못했습니다", style = Type.Body.copy(color = Ink.Faint))
        }

        for (s in body?.sections.orEmpty()) {
            Text(s.name.uppercase(), style = Type.Micro)
            Spacer(Modifier.height(11.dp))
            Blocks(s.blocks)
            Spacer(Modifier.height(Space.section - Space.block))
        }

        body?.solution?.let { sol ->
            Text("풀이  ·  ${sol.file}".uppercase(), style = Type.Micro)
            Spacer(Modifier.height(11.dp))
            Blocks(listOf(Block(t = "code", lang = sol.lang, text = sol.code)))
        }

        Spacer(Modifier.height(60.dp))
    }
}

private fun statusLabel(status: String) = when (status) {
    "solved" -> "풀었음"
    "attempting" -> "푸는 중"
    "failed" -> "실패"
    else -> "안 풀었음"
}

// ─────────────────────────────────────────────── 개념 사전

@Composable
fun ConceptsPane(index: Index, selectedId: String?, onSelect: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Column(Modifier.padding(horizontal = Space.page)) {
                Spacer(Modifier.height(8.dp))
                Text("${index.concepts.size}", style = Type.Ghost)
                Spacer(Modifier.height(4.dp))
                Text("개념 사전", style = Type.Title)
                Spacer(Modifier.height(Space.section))
            }
        }
        items(index.concepts, key = { it.id }) { c ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(if (c.id == selectedId) Ink.Wash else Ink.Paper)
                    .clickable { onSelect(c.id) }
                    .padding(horizontal = Space.page, vertical = Space.row)
            ) {
                Text(c.title, style = Type.Row.copy(color = Ink.Strong))
                if (c.tags.isNotEmpty()) {
                    Spacer(Modifier.height(5.dp))
                    Text(c.tags.joinToString("  ·  "), style = Type.Meta)
                }
            }
            Hairline()
        }
        item { Spacer(Modifier.height(40.dp)) }
    }
}

@Composable
fun ConceptPane(c: ConceptMeta, body: ConceptBody?, diagrams: Map<String, Diagram>) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Space.page)
    ) {
        Spacer(Modifier.height(28.dp))
        Text(c.title, style = Type.Title)
        if (c.tags.isNotEmpty()) {
            Spacer(Modifier.height(11.dp))
            Text(c.tags.joinToString("  ·  ").uppercase(), style = Type.Micro)
        }

        Spacer(Modifier.height(20.dp))
        Hairline()
        Spacer(Modifier.height(Space.block))

        c.diagram?.let { id ->
            diagrams[id]?.let {
                DiagramView(it, Modifier.fillMaxWidth())
                Spacer(Modifier.height(Space.section))
            }
        }

        Blocks(body?.blocks.orEmpty())
        Spacer(Modifier.height(60.dp))
    }
}

// ─────────────────────────────────────────────── 빈 오른쪽 면

@Composable
fun EmptyPane(text: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, style = Type.Row.copy(color = Ink.Faint))
    }
}

// ─────────────────────────────────────────────── 상단 텍스트 탭

@Composable
fun TextTabs(tab: Tab, onTab: (Tab) -> Unit, back: (() -> Unit)?, status: String, onStatus: () -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = Space.page, vertical = 15.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for (t in Tab.entries) {
                Text(
                    text = t.label,
                    style = Type.Tab.copy(
                        color = if (t == tab) Ink.Strong else Ink.Faint,
                        fontWeight = if (t == tab) FontWeight.Bold else FontWeight.Medium,
                    ),
                    modifier = Modifier.clickable { onTab(t) }.padding(end = 18.dp),
                )
            }
            Spacer(Modifier.weight(1f))
            if (back != null) {
                Text(
                    "뒤로",
                    style = Type.Tab.copy(color = Ink.Muted, fontWeight = FontWeight.Medium),
                    modifier = Modifier.clickable(onClick = back).padding(end = 14.dp),
                )
            }
            // 갱신 상태가 곧 설정 입구다. 평소엔 "설정", 무언가 오갈 때만 그 사실을 말한다.
            Text(
                status,
                style = Type.Meta.copy(color = Ink.Muted),
                modifier = Modifier.clickable(onClick = onStatus),
            )
        }
        Hairline()
    }
}

enum class Tab(val label: String) {
    Problems("문제"),
    Concepts("개념"),
}

@Composable
fun VerticalHairline() {
    Box(Modifier.width(1.dp).fillMaxSize().background(Ink.Hairline))
}
