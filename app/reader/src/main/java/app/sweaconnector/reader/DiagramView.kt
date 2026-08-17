package app.sweaconnector.reader

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.rememberTextMeasurer

/**
 * 도식을 Canvas 로 직접 그린다.
 *
 * VectorDrawable 을 쓰지 않는 이유: VectorDrawable 은 <text> 를 지원하지 않아서
 * 라벨이 사라진다. 도형과 라벨을 같은 Canvas 에서 그리면 라벨이 앱 폰트로 렌더되므로
 * 한글이 되고, 확대해도 선명하며, 런타임에 파싱할 것이 없다.
 */
@Composable
fun DiagramView(diagram: Diagram, modifier: Modifier = Modifier) {
    val measurer = rememberTextMeasurer()

    Canvas(modifier.aspectRatio(diagram.width / diagram.height)) {
        val k = size.width / diagram.width

        for (sh in diagram.shapes) {
            val fill = sh.fill?.let { parseHex(it, Ink.Strong) }
            val stroke = sh.stroke?.let { parseHex(it, Ink.Strong) }
            val lw = (sh.w * k).coerceAtLeast(0.7f)

            when (sh.k) {
                "line" -> stroke?.let {
                    drawLine(
                        color = it, alpha = sh.o,
                        start = Offset((sh.x1 ?: 0f) * k, (sh.y1 ?: 0f) * k),
                        end = Offset((sh.x2 ?: 0f) * k, (sh.y2 ?: 0f) * k),
                        strokeWidth = lw,
                    )
                }

                "circle" -> {
                    val c = Offset((sh.cx ?: 0f) * k, (sh.cy ?: 0f) * k)
                    val r = (sh.r ?: 0f) * k
                    fill?.let { drawCircle(it, r, c, alpha = sh.o) }
                    stroke?.let { drawCircle(it, r, c, alpha = sh.o, style = Stroke(lw)) }
                }

                "rect" -> {
                    val tl = Offset((sh.x ?: 0f) * k, (sh.y ?: 0f) * k)
                    val sz = Size((sh.w2 ?: 0f) * k, (sh.h2 ?: 0f) * k)
                    fill?.let { drawRect(it, tl, sz, alpha = sh.o) }
                    stroke?.let { drawRect(it, tl, sz, alpha = sh.o, style = Stroke(lw)) }
                }

                "poly" -> if (sh.pts.size >= 2) {
                    val path = Path().apply {
                        moveTo(sh.pts[0][0] * k, sh.pts[0][1] * k)
                        for (i in 1 until sh.pts.size) lineTo(sh.pts[i][0] * k, sh.pts[i][1] * k)
                        if (sh.closed) close()
                    }
                    fill?.let { drawPath(path, it, alpha = sh.o) }
                    stroke?.let { drawPath(path, it, alpha = sh.o, style = Stroke(lw)) }
                }
            }
        }

        for (lb in diagram.labels) {
            val layout = measurer.measure(
                AnnotatedString(lb.s),
                TextStyle(
                    fontFamily = if (lb.family == "serif") FontFamily.Serif else FontFamily.SansSerif,
                    fontSize = (lb.size * k).toSp(),
                    color = parseHex(lb.color, Ink.Strong),
                ),
            )
            // SVG 의 text y 는 베이스라인, Compose 의 topLeft 는 글자 상자의 위쪽
            val dx = when (lb.anchor) {
                "middle" -> layout.size.width / 2f
                "end" -> layout.size.width.toFloat()
                else -> 0f
            }
            drawText(layout, topLeft = Offset(lb.x * k - dx, lb.y * k - layout.firstBaseline))
        }
    }
}
