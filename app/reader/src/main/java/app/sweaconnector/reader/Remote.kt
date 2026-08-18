package app.sweaconnector.reader

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

// 저장소에서 파일 하나를 읽어 오는 창구.
//
// git 클라이언트를 넣지 않는다. 우리가 받는 것은 .swea/ 안의 작은 JSON 몇 개뿐이고,
// 그 정도에 JGit 과 온디바이스 마크다운 파서를 얹으면 앱만 무거워진다.
// 대신 호스트가 이미 주는 "파일 하나 내려주기" API 를 쓴다 — private 저장소도 토큰 하나로 열린다.

enum class Host { GitHub, GitLab }

data class GitTarget(
    val host: String,
    val owner: String,
    val name: String,
    val branch: String,
    val kind: Host,
)

/**
 * git 주소를 쪼갠다. https / ssh / 끝의 .git 을 모두 받는다.
 *
 * github.com 이 아니면 GitLab 으로 본다 — 자체 호스팅 GitLab(예: lab.ssafy.com)이 그 나머지의 거의 전부다.
 */
fun parseGitUrl(raw: String, branch: String): GitTarget {
    val cleaned = raw.trim().removeSuffix("/").removeSuffix(".git")
    require(cleaned.isNotEmpty()) { "git 주소를 입력하세요" }

    val ssh = Regex("^(?:ssh://)?git@([^:/]+)[:/](.+)$").find(cleaned)
    val http = Regex("^https?://(?:[^@/]+@)?([^/]+)/(.+)$").find(cleaned)
    val m = ssh ?: http ?: throw IllegalArgumentException("git 주소 형식이 아닙니다: $raw")

    val host = m.groupValues[1]
    val parts = m.groupValues[2].split("/").filter { it.isNotEmpty() }
    require(parts.size >= 2) { "소유자/저장소 형태여야 합니다: $raw" }

    return GitTarget(
        host = host,
        owner = parts.dropLast(1).joinToString("/"), // GitLab 은 그룹이 여러 겹일 수 있다
        name = parts.last(),
        branch = branch.ifBlank { "main" },
        kind = if (host.equals("github.com", ignoreCase = true)) Host.GitHub else Host.GitLab,
    )
}

class Remote(private val target: GitTarget, private val token: String?) {

    /** 저장소 안의 경로 하나를 통째로 읽는다. */
    fun fetch(path: String): ByteArray {
        val conn = (URL(urlFor(path)).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 20_000
            requestMethod = "GET"
            setRequestProperty("User-Agent", "sweaConnector-reader")
            when (target.kind) {
                Host.GitHub -> {
                    setRequestProperty("Accept", "application/vnd.github.raw")
                    token?.takeIf { it.isNotBlank() }?.let { setRequestProperty("Authorization", "Bearer $it") }
                }

                Host.GitLab -> token?.takeIf { it.isNotBlank() }?.let { setRequestProperty("PRIVATE-TOKEN", it) }
            }
        }

        try {
            return when (val code = conn.responseCode) {
                200 -> conn.inputStream.use { it.readBytes() }
                401, 403 -> throw IOException(
                    if (token.isNullOrBlank()) "비공개 저장소입니다 — 접근 토큰이 필요합니다"
                    else "토큰이 거부됐습니다 (권한 또는 만료 확인)"
                )

                // GitHub 은 권한 없는 private 저장소에 401 이 아니라 404 를 준다 (존재 자체를 숨긴다).
                // 그래서 여기서 "없다"고만 말하면, 토큰을 깜빡한 첫 실행이 엉뚱한 곳을 보게 된다.
                404 -> throw IOException(
                    if (token.isNullOrBlank())
                        "찾을 수 없습니다 — 비공개 저장소인데 토큰이 없거나, 주소·브랜치(${target.branch})가 틀렸습니다"
                    else
                        "찾을 수 없습니다: $path (브랜치 ${target.branch}) — 토큰에 이 저장소 권한이 있는지도 확인하세요"
                )
                else -> throw IOException("$code ${conn.responseMessage ?: ""}".trim())
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun urlFor(path: String): String = when (target.kind) {
        Host.GitHub ->
            "https://api.github.com/repos/${target.owner}/${target.name}/contents/${path.encodePath()}?ref=${target.branch.enc()}"

        Host.GitLab ->
            "https://${target.host}/api/v4/projects/${"${target.owner}/${target.name}".enc()}" +
                "/repository/files/${path.enc()}/raw?ref=${target.branch.enc()}"
    }
}

private fun String.enc(): String = URLEncoder.encode(this, "UTF-8")

/** GitHub 는 경로를 그대로 쓴다 — 구분자 슬래시는 살리고 각 조각만 인코딩한다. */
private fun String.encodePath(): String = split("/").joinToString("/") { it.enc() }
