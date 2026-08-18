package app.sweaconnector.reader

import kotlinx.serialization.Serializable

// 학습 저장소의 .swea/ 와 1:1.
// 파이프라인이 이미 블록·도형으로 바꿔 놓았으므로 앱에는 마크다운 파서도 SVG 파서도 없다.
//
// 나뉜 이유: 목록에 필요한 메타는 전부 인덱스에 있고, 본문은 조각 파일에 따로 있다.
// 그래서 시작할 때 인덱스 하나만 읽으면 목록이 뜨고, 진도만 바뀐 날은 본문을 한 조각도 받지 않는다.

const val SUPPORTED_FORMAT = 1

@Serializable
data class Index(
    val formatVersion: Int = 0,
    val generatedAt: String = "",
    val config: Config = Config(),
    val weeks: List<Week> = emptyList(),
    val problems: List<ProblemMeta> = emptyList(),
    val concepts: List<ConceptMeta> = emptyList(),
    val diagramsHash: String = "",
)

@Serializable
data class Config(
    val startDate: String? = null,
    val examDate: String? = null,
)

@Serializable
data class Week(
    val week: Int = 0,
    val problems: List<String> = emptyList(),
)

/** 목록 한 줄과 상세 머리말을 그리는 데 필요한 전부. 본문은 없다. */
@Serializable
data class ProblemMeta(
    val key: String = "",
    val week: Int = 0,
    val day: Int = 0,
    val problemId: Int? = null,
    val title: String = "",
    val type: String = "basic",
    val difficulty: String? = null,
    val topic: List<String> = emptyList(),
    val source: String? = null,
    val status: String = "todo",
    val scheduledOn: String? = null,
    val solvedAt: String? = null,
    val attempts: Int? = null,
    val timeSpentMin: Int? = null,
    val concepts: List<String> = emptyList(),
    val diagram: String? = null,
    /** 본문 조각의 내용 해시. 이게 그대로면 다시 받지 않는다. */
    val hash: String = "",
)

@Serializable
data class ConceptMeta(
    val id: String = "",
    val title: String = "",
    val tags: List<String> = emptyList(),
    val diagram: String? = null,
    val hash: String = "",
)

@Serializable
data class ProblemBody(
    val key: String = "",
    val sections: List<Section> = emptyList(),
    val solution: Solution? = null,
)

@Serializable
data class ConceptBody(
    val id: String = "",
    val blocks: List<Block> = emptyList(),
)

@Serializable
data class Section(
    val name: String = "",
    val blocks: List<Block> = emptyList(),
)

@Serializable
data class Solution(
    val file: String = "",
    val lang: String = "text",
    val code: String = "",
)

/** t: h | p | ul | ol | check | code | table | quote | hr */
@Serializable
data class Block(
    val t: String = "p",
    val level: Int = 2,
    val spans: List<Span> = emptyList(),
    val items: List<Item> = emptyList(),
    val head: List<List<Span>> = emptyList(),
    val rows: List<List<List<Span>>> = emptyList(),
    val lang: String? = null,
    val text: String = "",
)

@Serializable
data class Item(
    val spans: List<Span> = emptyList(),
    val done: Boolean = false,
)

/** t: t(평문) | b(굵게) | c(코드) | ref(개념 링크) */
@Serializable
data class Span(
    val t: String = "t",
    val s: String = "",
)

@Serializable
data class Diagram(
    val width: Float = 100f,
    val height: Float = 100f,
    val shapes: List<Shape> = emptyList(),
    val labels: List<Label> = emptyList(),
)

/** k: line | circle | rect | poly | path */
@Serializable
data class Shape(
    val k: String = "line",
    val x1: Float? = null, val y1: Float? = null,
    val x2: Float? = null, val y2: Float? = null,
    val cx: Float? = null, val cy: Float? = null, val r: Float? = null,
    val x: Float? = null, val y: Float? = null,
    val w2: Float? = null, val h2: Float? = null, val rx: Float = 0f,
    val pts: List<List<Float>> = emptyList(),
    val closed: Boolean = false,
    val d: String? = null,
    val stroke: String? = null,
    val fill: String? = null,
    val w: Float = 1f,
    val o: Float = 1f,
)

@Serializable
data class Label(
    val x: Float = 0f,
    val y: Float = 0f,
    val s: String = "",
    val size: Float = 14f,
    val color: String = "#1a1a1a",
    val anchor: String = "start",
    val family: String = "sans",
)
