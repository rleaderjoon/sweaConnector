package app.sweaconnector.reader

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// 디자인 원칙 (레퍼런스에서 뽑은 것)
//  1. 흰 종이. 카드도, 그림자도, 둥근 상자도 없다.
//  2. 위계는 색이 아니라 회색조와 굵기로만 만든다. 다 푼 것은 검고, 아직 안 푼 것은 연하다.
//  3. 구분선은 머리카락 한 올. 1dp 보다 얇게 보이도록 아주 연한 회색.
//  4. 모서리의 큰 흐린 숫자가 페이지 표시를 대신한다.
//  5. 아이콘 대신 글자. 탭도, 뒤로도 전부 텍스트.

object Ink {
    val Strong = Color(0xFF111111)   // 본문·완료
    val Body = Color(0xFF2E2E2E)     // 읽기용 본문
    val Muted = Color(0xFF8A8A8A)    // 라벨·보조
    val Faint = Color(0xFFC2C2C2)    // 미완료 항목
    val Hairline = Color(0xFFEAEAEA) // 구분선
    val Ghost = Color(0xFFF2F1EE)    // 모서리 큰 숫자
    val Paper = Color(0xFFFFFFFF)
    val Wash = Color(0xFFF8F7F5)     // 코드 블록 배경
}

object Type {
    private val Sans = FontFamily.SansSerif
    val Mono = FontFamily.Monospace

    /** 모서리의 거대한 흐린 숫자 */
    val Ghost = TextStyle(
        fontFamily = Sans, fontSize = 92.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-4).sp, color = Ink.Ghost,
    )

    /** 화면 제목 */
    val Title = TextStyle(
        fontFamily = Sans, fontSize = 27.sp, fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.7).sp, lineHeight = 33.sp, color = Ink.Strong,
    )

    /** 상단 텍스트 탭 */
    val Tab = TextStyle(
        fontFamily = Sans, fontSize = 21.sp, fontWeight = FontWeight.Medium,
        letterSpacing = (-0.4).sp,
    )

    /** 목록 한 줄 */
    val Row = TextStyle(
        fontFamily = Sans, fontSize = 16.sp, fontWeight = FontWeight.Medium,
        letterSpacing = (-0.2).sp, lineHeight = 21.sp,
    )

    /** 본문 — 전자책 읽기용 행간 */
    val Body = TextStyle(
        fontFamily = Sans, fontSize = 15.sp, fontWeight = FontWeight.Normal,
        lineHeight = 26.sp, color = Ink.Body,
    )

    /** 본문 안 소제목 */
    val Head = TextStyle(
        fontFamily = Sans, fontSize = 17.sp, fontWeight = FontWeight.SemiBold,
        letterSpacing = (-0.3).sp, color = Ink.Strong,
    )

    /** 아주 작은 대문자 라벨 */
    val Micro = TextStyle(
        fontFamily = Sans, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.6.sp, color = Ink.Muted,
    )

    /** 보조 설명 */
    val Meta = TextStyle(
        fontFamily = Sans, fontSize = 12.sp, fontWeight = FontWeight.Normal,
        letterSpacing = 0.sp, color = Ink.Muted,
    )

    val Code = TextStyle(
        fontFamily = Mono, fontSize = 12.5.sp, lineHeight = 20.sp, color = Ink.Body,
    )
}

object Space {
    val page = 26.dp      // 좌우 여백
    val row = 17.dp       // 목록 한 줄의 위아래
    val block = 14.dp     // 블록 사이
    val section = 34.dp   // 섹션 사이
}

/**
 * 접힘/펼침 판정. 폭이 이 값을 넘으면 책 펼친 면처럼 2단으로 간다.
 *
 * 600dp 는 Material 의 medium 브레이크포인트다. 폴드 커버 화면(~344dp)과
 * 펼친 화면(밀도에 따라 673~790dp)을 여유 있게 가른다 — 경계에 붙여 놓으면
 * 밀도가 조금 다른 기기에서 판정이 뒤집힌다.
 */
val TwoPaneWidth = 600.dp

/** 목차 면 폭. 고정값을 쓰면 좁은 펼침 화면에서 본문이 눌린다. */
fun listPaneWidth(total: androidx.compose.ui.unit.Dp) =
    (total * 0.4f).coerceIn(300.dp, 380.dp)

fun parseHex(hex: String?, fallback: Color): Color {
    val h = hex?.removePrefix("#") ?: return fallback
    return try {
        when (h.length) {
            6 -> Color(0xFF000000L.toInt() or h.toInt(16))
            8 -> Color(h.toLong(16).toInt())
            else -> fallback
        }
    } catch (_: NumberFormatException) {
        fallback
    }
}
