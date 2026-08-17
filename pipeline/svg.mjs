// SVG -> { width, height, shapes[], labels[] }
//
// Android VectorDrawable 은 <text> 를 지원하지 않는다. 그래서 도형과 라벨을 갈라
// 앱에서 Compose Canvas 가 둘을 함께 그린다 — 라벨이 앱 폰트로 렌더되므로 한글이 되고,
// 원본 SVG 는 저장소에서 그대로 보이는 단일 출처로 남는다.
//
// 내가 쓰는 문법만 다룬다: g / line / circle / rect / polyline / path / text

import { readdir, readFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIAGRAMS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'diagrams')

export async function readDiagrams(dir = DIAGRAMS_DIR) {
  let files
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.svg'))
  } catch {
    return {}
  }

  const out = {}
  for (const file of files.sort()) {
    out[basename(file, '.svg')] = parseSvg(await readFile(join(dir, file), 'utf8'))
  }
  return out
}

export function parseSvg(src) {
  const vb = /viewBox="([\d.\s-]+)"/.exec(src)
  const [, , w, h] = vb ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, 100, 100]

  const shapes = []
  const labels = []
  walk(src, { stroke: null, fill: null, strokeWidth: 1, opacity: 1, fontSize: 14, anchor: 'start', family: 'sans' })

  return { width: w, height: h, shapes, labels }

  function walk(chunk, inherited) {
    // <g ...> ... </g> 를 찾아 속성을 상속시키며 내려간다
    const gRe = /<g\b([^>]*)>([\s\S]*?)<\/g>/g
    let cursor = 0
    let m
    while ((m = gRe.exec(chunk)) !== null) {
      leaves(chunk.slice(cursor, m.index), inherited)
      walk(m[2], { ...inherited, ...attrsOf(m[1]) })
      cursor = m.index + m[0].length
    }
    leaves(chunk.slice(cursor), inherited)
  }

  function leaves(chunk, st) {
    for (const [, tag, raw] of chunk.matchAll(/<(line|circle|rect|polyline|polygon|path)\b([^>]*?)\/?>/g)) {
      const a = { ...st, ...attrsOf(raw) }
      const num = k => {
        const hit = raw.match(new RegExp(`\\b${k}="([^"]+)"`))
        return hit ? Number(hit[1]) : undefined
      }
      const style = { stroke: a.stroke, fill: a.fill, w: a.strokeWidth, o: a.opacity }

      if (tag === 'line') {
        shapes.push({ k: 'line', x1: num('x1'), y1: num('y1'), x2: num('x2'), y2: num('y2'), ...style })
      } else if (tag === 'circle') {
        shapes.push({ k: 'circle', cx: num('cx'), cy: num('cy'), r: num('r'), ...style })
      } else if (tag === 'rect') {
        shapes.push({ k: 'rect', x: num('x'), y: num('y'), w2: num('width'), h2: num('height'), rx: num('rx') ?? 0, ...style })
      } else if (tag === 'polyline' || tag === 'polygon') {
        const pts = (raw.match(/points="([^"]+)"/)?.[1] ?? '').trim().split(/\s+/)
          .map(p => p.split(',').map(Number)).filter(p => p.length === 2)
        shapes.push({ k: 'poly', pts, closed: tag === 'polygon', ...style })
      } else if (tag === 'path') {
        shapes.push({ k: 'path', d: raw.match(/\bd="([^"]+)"/)?.[1] ?? '', ...style })
      }
    }

    for (const [, raw, text] of chunk.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const a = { ...st, ...attrsOf(raw) }
      labels.push({
        x: Number(raw.match(/\bx="([^"]+)"/)?.[1] ?? 0),
        y: Number(raw.match(/\by="([^"]+)"/)?.[1] ?? 0),
        s: text.trim(),
        size: a.fontSize,
        color: a.fill ?? '#1a1a1a',
        anchor: a.anchor,
        family: a.family,
      })
    }
  }
}

function attrsOf(raw) {
  const out = {}
  const get = k => raw.match(new RegExp(`\\b${k}="([^"]+)"`))?.[1]

  const stroke = get('stroke')
  if (stroke) out.stroke = stroke === 'none' ? null : stroke
  const fill = get('fill')
  if (fill) out.fill = fill === 'none' ? null : fill
  const sw = get('stroke-width')
  if (sw) out.strokeWidth = Number(sw)
  const op = get('opacity')
  if (op) out.opacity = Number(op)
  const fs = get('font-size')
  if (fs) out.fontSize = Number(fs)
  const ta = get('text-anchor')
  if (ta) out.anchor = ta
  const ff = get('font-family')
  if (ff) out.family = ff.includes('serif') && !ff.includes('sans') ? 'serif' : 'sans'

  return out
}
