// 마크다운 -> 블록 배열. 앱은 런타임에 마크다운을 파싱하지 않는다.
// 필요한 문법만 다룬다: 제목 / 문단 / 목록 / 체크박스 / 코드펜스 / 표 / 인용 / 구분선
// 인라인: **굵게**, `코드`, [[개념id]]

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g

/** @returns {Array<object>} 블록 배열 */
export function toBlocks(md) {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    // 코드 펜스
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const body = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++])
      i++ // 닫는 펜스
      blocks.push({ t: 'code', lang: lang || null, text: body.join('\n') })
      continue
    }

    // 구분선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ t: 'hr' })
      i++
      continue
    }

    // 제목
    const h = /^(#{1,6}) +(.*)$/.exec(trimmed)
    if (h) {
      blocks.push({ t: 'h', level: h[1].length, spans: inline(h[2]) })
      i++
      continue
    }

    // 표: 헤더 줄 + 구분 줄
    if (trimmed.includes('|') && i + 1 < lines.length && /^\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1].trim())) {
      const head = cells(lines[i])
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]))
      blocks.push({ t: 'table', head: head.map(inline), rows: rows.map(r => r.map(inline)) })
      continue
    }

    // 인용
    if (trimmed.startsWith('>')) {
      const body = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        body.push(lines[i++].trim().replace(/^>\s?/, ''))
      }
      blocks.push({ t: 'quote', spans: inline(body.join(' ')) })
      continue
    }

    // 체크박스 목록
    if (/^[-*] +\[[ xX]\]/.test(trimmed)) {
      const items = []
      while (i < lines.length) {
        const m = /^[-*] +\[([ xX])\] *(.*)$/.exec(lines[i].trim())
        if (!m) break
        items.push({ done: m[1] !== ' ', spans: inline(m[2]) })
        i++
      }
      blocks.push({ t: 'check', items })
      continue
    }

    // 불릿 목록
    if (/^[-*] +/.test(trimmed) || trimmed === '-') {
      const items = []
      while (i < lines.length && (/^[-*] +/.test(lines[i].trim()) || lines[i].trim() === '-')) {
        items.push({ spans: inline(lines[i].trim().replace(/^[-*] */, '')) })
        i++
      }
      blocks.push({ t: 'ul', items: items.filter(it => it.spans.length) })
      continue
    }

    // 번호 목록
    if (/^\d+[.)] +/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^\d+[.)] +/.test(lines[i].trim())) {
        items.push({ spans: inline(lines[i].trim().replace(/^\d+[.)] +/, '')) })
        i++
      }
      blocks.push({ t: 'ol', items })
      continue
    }

    // 문단 — 빈 줄이나 다른 블록 시작까지 이어 붙인다
    const para = []
    while (i < lines.length) {
      const t = lines[i].trim()
      if (!t || t.startsWith('```') || t.startsWith('>') || /^#{1,6} /.test(t) ||
          /^[-*] +/.test(t) || /^\d+[.)] +/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t) ||
          (t.includes('|') && /^\|/.test(t))) break
      para.push(t)
      i++
    }
    if (para.length) blocks.push({ t: 'p', spans: inline(para.join(' ')) })
    else i++
  }

  return blocks
}

/** 인라인 문법을 스팬 배열로. */
export function inline(text) {
  const spans = []
  let last = 0
  const s = String(text ?? '')

  for (const m of s.matchAll(INLINE_RE)) {
    if (m.index > last) spans.push({ t: 't', s: s.slice(last, m.index) })
    const tok = m[0]
    if (tok.startsWith('**')) spans.push({ t: 'b', s: tok.slice(2, -2) })
    else if (tok.startsWith('`')) spans.push({ t: 'c', s: tok.slice(1, -1) })
    else spans.push({ t: 'ref', s: tok.slice(2, -2) })
    last = m.index + tok.length
  }
  if (last < s.length) spans.push({ t: 't', s: s.slice(last) })

  return spans.filter(sp => sp.s !== '')
}

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
}
