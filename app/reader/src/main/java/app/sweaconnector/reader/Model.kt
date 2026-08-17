package app.sweaconnector.reader

import kotlinx.serialization.Serializable

// content.json 과 1:1. 파이프라인이 이미 블록·도형으로 바꿔 놓았으므로
// 앱에는 마크다운 파서도 SVG 파서도 없다.

@Serializable
data class Content(
    val generatedAt: String = "",
    val config: Config = Config(),
    val weeks: List<Week> = emptyList(),
    val problems: List<Problem> = emptyList(),
    val concepts: List<Concept> = emptyList(),
    val diagrams: Map<String, Diagram> = emptyMap(),
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

@Serializable
data class Problem(
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
    val sections: List<Section> = emptyList(),
    val solution: Solution? = null,
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

@Serializable
data class Concept(
    val id: String = "",
    val title: String = "",
    val tags: List<String> = emptyList(),
    val diagram: String? = null,
    val blocks: List<Block> = emptyList(),
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
