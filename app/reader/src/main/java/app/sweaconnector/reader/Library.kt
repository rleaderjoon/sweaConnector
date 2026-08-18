package app.sweaconnector.reader

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

// 화면이 보는 단 하나의 창구.
//
// 순서가 요점이다: 로컬 사본으로 먼저 그리고, 그다음에 원격을 본다.
// 시작할 때 네트워크를 기다리는 구간이 없어야 "켜자마자 뜬다"가 성립한다.

private val json = Json { ignoreUnknownKeys = true }

private const val DIR = ".swea"

/** 한 번에 겹쳐 받는 조각 수. 첫 실행이 수십 개라 직렬로 받으면 왕복 지연만 쌓인다. */
private const val PARALLEL = 6

sealed interface Sync {
    data object Idle : Sync
    data object Running : Sync
    data class Done(val changed: Int) : Sync
    data class Failed(val message: String) : Sync
}

class Library(private val store: Store, val settings: Settings) {

    var index by mutableStateOf<Index?>(null)
        private set

    var diagrams by mutableStateOf<Map<String, Diagram>>(emptyMap())
        private set

    var sync by mutableStateOf<Sync>(Sync.Idle)
        private set

    // 본문은 눌린 것만, 한 번만 푼다. 갱신된 조각은 여기서 빼서 다음에 다시 읽게 한다.
    private val problemBodies = HashMap<String, ProblemBody>()
    private val conceptBodies = HashMap<String, ConceptBody>()

    val ready: Boolean get() = index != null

    /** 로컬 사본을 읽는다. 인덱스 하나와 도식 하나뿐이라 첫 프레임 전에 끝난다. */
    fun loadCache() {
        index = store.readIndex()?.let { runCatching { json.decodeFromString<Index>(it.decodeToString()) }.getOrNull() }
        diagrams = store.readDiagrams()
            ?.let { runCatching { json.decodeFromString<Map<String, Diagram>>(it.decodeToString()) }.getOrNull() }
            ?: emptyMap()
    }

    /**
     * 원격 인덱스를 받아 해시가 다른 조각만 내려받는다.
     * 진도만 바뀐 날은 인덱스 한 개(수 KB)만 오간다.
     */
    suspend fun refresh(): Sync = withContext(Dispatchers.IO) {
        sync = Sync.Running
        val result = runCatching { pull() }
            .fold({ Sync.Done(it) }, { Sync.Failed(it.message ?: it::class.simpleName ?: "알 수 없는 오류") })
        sync = result
        result
    }

    private suspend fun pull(): Int = coroutineScope {
        val url = settings.gitUrl?.takeIf { it.isNotBlank() } ?: error("저장소 주소가 없습니다")
        val remote = Remote(parseGitUrl(url, settings.branch), settings.token)

        val indexBytes = remote.fetch("$DIR/index.json")
        val next = json.decodeFromString<Index>(indexBytes.decodeToString())
        if (next.formatVersion != SUPPORTED_FORMAT) {
            error("콘텐츠 형식 v${next.formatVersion} — 이 앱은 v$SUPPORTED_FORMAT 을 읽습니다")
        }

        val local = index
        val known = local?.problems?.associate { it.key to it.hash } ?: emptyMap()
        val knownConcepts = local?.concepts?.associate { it.id to it.hash } ?: emptyMap()

        // 해시가 그대로면 건너뛴다. 여기서 걸러진 수가 곧 아끼는 요청 수다.
        val staleProblems = next.problems.filter { known[it.key] != it.hash || !store.hasProblem(it.key) }
        val staleConcepts = next.concepts.filter { knownConcepts[it.id] != it.hash || !store.hasConcept(it.id) }
        var changed = staleProblems.size + staleConcepts.size

        download(remote, staleProblems.map { it.key to "$DIR/problems/${it.key}.json" }) { key, bytes ->
            store.writeProblem(key, bytes)
            problemBodies.remove(key)
        }

        download(remote, staleConcepts.map { it.id to "$DIR/concepts/${it.id}.json" }) { id, bytes ->
            store.writeConcept(id, bytes)
            conceptBodies.remove(id)
        }

        if (next.diagramsHash != local?.diagramsHash || !store.hasDiagrams()) {
            val bytes = remote.fetch("$DIR/diagrams.json")
            store.writeDiagrams(bytes)
            diagrams = json.decodeFromString(bytes.decodeToString())
            changed++
        }

        store.prune(next.problems.map { it.key }.toSet(), next.concepts.map { it.id }.toSet())
        // 인덱스는 조각을 다 받은 뒤에 쓴다. 중간에 끊기면 다음 실행이 같은 자리에서 이어받는다.
        store.writeIndex(indexBytes)
        index = next
        changed
    }

    /** 몇 개씩 겹쳐 받는다. 한꺼번에 다 열면 연결 수만 늘고 오히려 느려진다. */
    private suspend fun download(remote: Remote, items: List<Pair<String, String>>, save: (String, ByteArray) -> Unit) {
        for (batch in items.chunked(PARALLEL)) {
            coroutineScope { batch.map { (id, path) -> async { id to remote.fetch(path) } }.awaitAll() }
                .forEach { (id, bytes) -> save(id, bytes) }
        }
    }

    fun problem(key: String): ProblemBody? = problemBodies.getOrPutNotNull(key) {
        store.readProblem(key)?.let { runCatching { json.decodeFromString<ProblemBody>(it.decodeToString()) }.getOrNull() }
    }

    fun concept(id: String): ConceptBody? = conceptBodies.getOrPutNotNull(id) {
        store.readConcept(id)?.let { runCatching { json.decodeFromString<ConceptBody>(it.decodeToString()) }.getOrNull() }
    }

    /** 저장소를 바꾼다. 이전 사본은 버린다 — 섞이면 목록에 남의 문제가 뜬다. */
    fun connect(gitUrl: String, branch: String, token: String?) {
        settings.gitUrl = gitUrl.trim()
        settings.branch = branch.trim()
        settings.token = token?.trim()
        store.clear()
        problemBodies.clear()
        conceptBodies.clear()
        index = null
        diagrams = emptyMap()
        sync = Sync.Idle
    }
}

private inline fun <K, V> HashMap<K, V>.getOrPutNotNull(key: K, make: () -> V?): V? =
    this[key] ?: make()?.also { this[key] = it }
