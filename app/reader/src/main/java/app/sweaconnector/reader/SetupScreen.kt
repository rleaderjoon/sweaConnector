package app.sweaconnector.reader

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/**
 * 첫 화면 — 어느 저장소를 읽을지 정한다.
 *
 * 앱에는 콘텐츠가 한 글자도 들어 있지 않다. 여기 적은 저장소가 곧 이 앱의 내용이다.
 */
@Composable
fun SetupScreen(library: Library, onConnected: () -> Unit) {
    var url by rememberSaveable { mutableStateOf(library.settings.gitUrl ?: "") }
    var branch by rememberSaveable { mutableStateOf(library.settings.branch) }
    var token by remember { mutableStateOf(library.settings.token ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val connect = {
        if (!busy) {
            busy = true
            error = null
            scope.launch {
                library.connect(url, branch, token)
                when (val r = library.refresh()) {
                    is Sync.Failed -> {
                        error = r.message
                        busy = false
                    }

                    else -> {
                        busy = false
                        onConnected()
                    }
                }
            }
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Space.page)
    ) {
        Spacer(Modifier.height(56.dp))
        Text("연결", style = Type.Title)
        Spacer(Modifier.height(11.dp))
        Text(
            "풀이를 올려 둔 git 저장소를 적으세요. 목록과 본문은 전부 그 저장소에서 옵니다.",
            style = Type.Body,
        )

        Spacer(Modifier.height(Space.section))

        Field(
            label = "GIT 주소",
            value = url,
            onChange = { url = it },
            placeholder = "https://github.com/<나>/<저장소>.git",
            keyboard = KeyboardType.Uri,
        )
        Field(
            label = "브랜치",
            value = branch,
            onChange = { branch = it },
            placeholder = "main",
        )
        Field(
            label = "접근 토큰",
            value = token,
            onChange = { token = it },
            placeholder = "비공개 저장소면 필요",
            masked = true,
            imeAction = ImeAction.Done,
            onDone = connect,
        )

        Spacer(Modifier.height(Space.block))
        Text(
            "토큰은 이 기기의 키스토어로 감싸 저장합니다. GitHub 은 Fine-grained token 의 Contents: Read, " +
                "GitLab 은 read_repository 면 충분합니다.",
            style = Type.Meta,
        )

        Spacer(Modifier.height(Space.section))
        Text(
            text = if (busy) "받는 중…" else "연결",
            style = Type.Tab.copy(color = if (busy) Ink.Faint else Ink.Strong),
            modifier = Modifier.clickable(enabled = !busy, onClick = connect),
        )

        error?.let {
            Spacer(Modifier.height(Space.block))
            Text(it, style = Type.Body.copy(color = Ink.Muted))
            Spacer(Modifier.height(6.dp))
            Text(
                "저장소에 .swea/ 가 없다면 MCP 의 publish_content 를 먼저 돌리세요.",
                style = Type.Meta,
            )
        }

        Spacer(Modifier.height(60.dp))
    }
}

@Composable
private fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    keyboard: KeyboardType = KeyboardType.Text,
    masked: Boolean = false,
    imeAction: ImeAction = ImeAction.Next,
    onDone: () -> Unit = {},
) {
    Column(Modifier.fillMaxWidth().padding(bottom = Space.section - Space.block)) {
        Text(label, style = Type.Micro)
        Spacer(Modifier.height(9.dp))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = Type.Row.copy(color = Ink.Strong),
            cursorBrush = SolidColor(Ink.Strong),
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = imeAction),
            keyboardActions = KeyboardActions(onDone = { onDone() }),
            visualTransformation = if (masked) PasswordVisualTransformation() else VisualTransformation.None,
            modifier = Modifier.fillMaxWidth(),
            decorationBox = { inner ->
                Column {
                    Box {
                        if (value.isEmpty()) Text(placeholder, style = Type.Row.copy(color = Ink.Faint))
                        inner()
                    }
                    Spacer(Modifier.height(9.dp))
                    Hairline()
                }
            },
        )
    }
}
