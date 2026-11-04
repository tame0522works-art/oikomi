/**
 * 問題づくりの下調べ（まとめて）。本文ごとに字詰め 8〜12・行数・ぶら下げ回数を振って、
 * 「最初の盤面に違反が2つ以上」かつ「頭から直すと最善にならない（行き詰まる・行数が違う・乱れが大きい）」組み合わせを出す。
 *   npx tsx tools/scan.ts 本文1 本文2 ...
 */
import { evaluate, initialBoard, type Puzzle } from '../src/engine/board.ts'
import { greedy, solve } from '../src/engine/solve.ts'
import { buildUnits } from '../src/engine/units.ts'

for (const text of process.argv.slice(2)) {
  const units = buildUnits(text)
  console.log(`\n${text.slice(0, 16)}…（${units.length} 字）`)
  for (let length = 8; length <= 12; length++) {
    const minRows = Math.ceil(units.length / (length + 1))
    for (let rows = minRows; rows <= minRows + 1; rows++) {
      for (let hangs = 0; hangs <= 1; hangs++) {
        const puzzle: Puzzle = { id: 'x', text, length, rows, hangs }
        const sol = solve(puzzle, units)
        if (!sol) continue
        const init = evaluate(puzzle, units, initialBoard(puzzle, units.length))
        const g = greedy(puzzle, units)
        const why = !g.valid ? '頭からは行き詰まる' : g.starts.length !== rows ? `頭からは ${g.starts.length} 行` : g.cost > sol.cost + 0.05 ? `頭からは乱れ ${g.cost.toFixed(1)}` : ''
        if (init.violations >= 2 && why) {
          console.log(`  length=${length} rows=${rows} hangs=${hangs}: 最善 ${sol.cost.toFixed(2)}（${sol.ways} 通り）、違反 ${init.violations}、${why}`)
        }
      }
    }
  }
}
