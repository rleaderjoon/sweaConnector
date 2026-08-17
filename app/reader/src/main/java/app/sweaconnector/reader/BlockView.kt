package app.sweaconnector.reader

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp

/** 블록 목록을 순서대로 그린다. 파이프라인이 이미 파싱해 두었으므로 여기서는 그리기만 한다. */
@Composable
fun Blocks(blocks: List<Block>) {
    Column(Modifier.fillMaxWidth()) {
        for (b in blocks) {
            when (b.t) {
                "h" -> {
                    Spacer(Modifier.height(Space.block))
                    Text(annotate(b.spans), style = Type.Head)
                    Spacer(Modifier.height(7.dp))
                }

                "p" -> {
                    Text(annotate(b.spans), style = Type.Body)
                    Spacer(Modifier.height(Space.block))
                }

                "ul", "ol" -> {
                    for ((i, item) in b.items.withIndex()) {
                        Row(Modifier.fillMaxWidth().padding(bottom = 7.dp)) {
                            Text(
                                text = if (b.t == "ol") "${i + 1}." else "·",
                                style = Type.Body.copy(color = Ink.Faint),
                                modifier = Modifier.width(if (b.t == "ol") 24.dp else 15.dp),
                            )
                            Text(annotate(item.spans), style = Type.Body)
                        }
                    }
                    Spacer(Modifier.height(Space.block - 7.dp))
                }

                "check" -> {
                    for (item in b.items) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Box(Modifier.width(22.dp).padding(top = 6.dp)) {
                                if (item.done) {
                                    Box(Modifier.size(11.dp).background(Ink.Strong))
                                } else {
                                    Box(Modifier.size(11.dp).border(1.dp, Ink.Faint))
                                }
                            }
                            Text(
                                annotate(item.spans),
                                style = Type.Body.copy(color = if (item.done) Ink.Body else Ink.Muted),
                            )
                        }
                    }
                    Spacer(Modifier.height(Space.block - 9.dp))
                }

                "code" -> {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .background(Ink.Wash)
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 13.dp)
                    ) {
                        Text(b.text, style = Type.Code)
                    }
                    Spacer(Modifier.height(Space.block))
                }

                "quote" -> {
                    Row(Modifier.fillMaxWidth()) {
                        Box(Modifier.width(2.dp).height(20.dp).background(Ink.Hairline))
                        Text(
                            annotate(b.spans),
                            style = Type.Body.copy(color = Ink.Muted),
                            modifier = Modifier.padding(start = 13.dp),
                        )
                    }
                    Spacer(Modifier.height(Space.block))
                }

                "table" -> {
                    TableBlock(b)
                    Spacer(Modifier.height(Space.block))
                }

                "hr" -> {
                    Spacer(Modifier.height(7.dp))
                    Hairline()
                    Spacer(Modifier.height(Space.block))
                }
            }
        }
    }
}

@Composable
private fun TableBlock(b: Block) {
    val cols = maxOf(b.head.size, b.rows.maxOfOrNull { it.size } ?: 0)
    if (cols == 0) return

    Column(Modifier.fillMaxWidth()) {
        if (b.head.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(bottom = 9.dp)) {
                for (c in 0 until cols) {
                    Text(
                        text = b.head.getOrNull(c)?.let { plain(it) }.orEmpty().uppercase(),
                        style = Type.Micro,
                        modifier = Modifier.weight(1f).padding(end = 10.dp),
                    )
                }
            }
            Hairline()
        }
        for (row in b.rows) {
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
                for (c in 0 until cols) {
                    Text(
                        text = row.getOrNull(c)?.let { annotate(it) } ?: AnnotatedString(""),
                        style = Type.Body.copy(lineHeight = Type.Body.fontSize * 1.5f),
                        modifier = Modifier.weight(1f).padding(end = 10.dp),
                    )
                }
            }
            Hairline()
        }
    }
}

/** 인라인 스팬 -> AnnotatedString. ref(개념 링크)는 굵게만 표시한다. */
fun annotate(spans: List<Span>): AnnotatedString = buildAnnotatedString {
    for (sp in spans) {
        when (sp.t) {
            "b" -> withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = Ink.Strong)) { append(sp.s) }
            "c" -> withStyle(SpanStyle(fontFamily = Type.Mono, color = Ink.Strong)) { append(sp.s) }
            "ref" -> withStyle(SpanStyle(color = Ink.Strong, fontWeight = FontWeight.Medium)) { append(sp.s) }
            else -> append(sp.s)
        }
    }
}

fun plain(spans: List<Span>): String = spans.joinToString("") { it.s }

@Composable
fun Hairline(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Ink.Hairline))
}
