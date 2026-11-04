/**
 * 全問の確認: 使ってよい字だけか・解けるか・最初の盤面に違反があるか・id が重ならないか。
 * 最善の乱れと、頭から直したときとの差も一覧にする（難しさの目安）。
 */
import { applyMove, evaluate, initialBoard } from '../src/engine/board.ts'
import { greedy, solve } from '../src/engine/solve.ts'
import { buildUnits } from '../src/engine/units.ts'
import { PUZZLES } from '../src/puzzles/index.ts'
import glyphs from '../src/glyphs.json' with { type: 'json' }
import { route } from '../src/engine/route.ts'

let failed = 0
const fail = (id: string, msg: string) => {
  console.error(`NG ${id}: ${msg}`)
  failed++
}
const ids = new Set<string>()
for (const p of PUZZLES) {
  if (ids.has(p.id)) fail(p.id, 'id が重なっている')
  ids.add(p.id)
  // ルビ・縦中横・欧文は扱わないので、半角や空白は入れない
  const bad = [...p.text].filter((c) => c.codePointAt(0)! < 0x3000 && c !== '―' && c !== '…' && c !== '—' && c !== '‥')
  if (bad.length) fail(p.id, `扱えない字がある: ${[...new Set(bad)].join(' ')}`)
  const missing = [...new Set(p.text)].filter((c) => !(c in glyphs))
  if (missing.length) fail(p.id, `字形データにない字（npm run glyphs を流す）: ${missing.join(' ')}`)
  const units = buildUnits(p.text)
  const sol = solve(p, units)
  if (!sol) {
    fail(p.id, '解けない')
    continue
  }
  const start = initialBoard(p, units.length)
  const init = evaluate(p, units, start)
  if (init.violations === 0) fail(p.id, '最初の盤面に違反がない')
  // 最善解が画面の操作だけで作れるか
  let steps = 0
  try {
    const path = route(p, units, start, sol.board)
    steps = path.length
    let b = start
    for (const [j, m] of path) b = applyMove(p, units, b, j, m)!
    if (JSON.stringify(b) !== JSON.stringify(sol.board)) fail(p.id, '操作でたどった盤面が最善解と違う')
  } catch (e) {
    fail(p.id, `操作で最善解まで行けない: ${e instanceof Error ? e.message : e}`)
  }
  const g = greedy(p, units)
  const note = !g.valid ? '頭からは行き詰まる' : g.starts.length !== p.rows ? `頭からは ${g.starts.length} 行` : g.cost > sol.cost + 0.05 ? `頭からは乱れ ${g.cost.toFixed(2)}` : '頭からでも最善'
  console.log(`ok ${p.id}: ${units.length} 字・${p.length}字×${p.rows}行・ぶら下げ ${p.hangs}、最善 ${sol.cost.toFixed(2)}（${sol.ways} 通り・${steps} 手）、最初の違反 ${init.violations}、${note}`)
}
if (failed) {
  console.error(`${failed} 件の問題がある`)
  process.exit(1)
}
console.log(`全 ${PUZZLES.length} 問 OK`)
