package app.sweaconnector.reader

import java.io.File

// 내려받은 .swea/ 를 그대로 흉내 낸 로컬 사본.
//
// 앱을 다시 켰을 때 네트워크를 기다리지 않고 곧바로 목록이 뜨는 근거가 이 디렉터리다.
// 원격과 같은 모양으로 두면 동기화가 "해시 다른 파일만 덮어쓰기"로 끝난다.

class Store(private val root: File) {

    private val problemsDir = File(root, "problems")
    private val conceptsDir = File(root, "concepts")

    init {
        problemsDir.mkdirs()
        conceptsDir.mkdirs()
    }

    fun readIndex(): ByteArray? = File(root, INDEX).readOrNull()

    fun writeIndex(bytes: ByteArray) = File(root, INDEX).writeAtomic(bytes)

    fun readProblem(key: String): ByteArray? = problemsDir.chunk(key)?.readOrNull()

    fun writeProblem(key: String, bytes: ByteArray) {
        problemsDir.chunk(key)?.writeAtomic(bytes)
    }

    fun hasProblem(key: String): Boolean = problemsDir.chunk(key)?.exists() == true

    fun readConcept(id: String): ByteArray? = conceptsDir.chunk(id)?.readOrNull()

    fun writeConcept(id: String, bytes: ByteArray) {
        conceptsDir.chunk(id)?.writeAtomic(bytes)
    }

    fun hasConcept(id: String): Boolean = conceptsDir.chunk(id)?.exists() == true

    fun readDiagrams(): ByteArray? = File(root, DIAGRAMS).readOrNull()

    fun writeDiagrams(bytes: ByteArray) = File(root, DIAGRAMS).writeAtomic(bytes)

    fun hasDiagrams(): Boolean = File(root, DIAGRAMS).exists()

    /** 저장소에서 사라진 것들을 지운다. 안 지우면 유령 항목이 계속 남는다. */
    fun prune(problemKeys: Set<String>, conceptIds: Set<String>) {
        problemsDir.listFiles()?.forEach { if (it.name.removeSuffix(".json") !in problemKeys) it.delete() }
        conceptsDir.listFiles()?.forEach { if (it.name.removeSuffix(".json") !in conceptIds) it.delete() }
    }

    /** 저장소를 바꿀 때. 남은 사본이 새 저장소의 목록과 섞이면 안 된다. */
    fun clear() {
        root.deleteRecursively()
        problemsDir.mkdirs()
        conceptsDir.mkdirs()
    }

    // 조각 이름은 원격 인덱스에서 온다. 경로로 해석될 여지를 여기서 끊는다.
    private fun File.chunk(name: String): File? =
        if (name.isNotEmpty() && name.all { it.isLetterOrDigit() || it in "._-" }) File(this, "$name.json") else null

    private fun File.readOrNull(): ByteArray? = if (exists()) readBytes() else null

    private fun File.writeAtomic(bytes: ByteArray) {
        val tmp = File(parentFile, "$name.tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(this)) {
            writeBytes(bytes)
            tmp.delete()
        }
    }

    private companion object {
        const val INDEX = "index.json"
        const val DIAGRAMS = "diagrams.json"
    }
}
