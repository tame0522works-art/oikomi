/**
 * ヒントだけで解けるかの確認。全問で、最初の盤面と、ランダムに操作した途中の盤面（各 200 通り）から
 * 「ヒントの1手を当てる」を繰り返して、最善解にたどり着くか・手が止まったり回り続けたりしないかを見る。
 */
import { applyMove, initialBoard, type Board, type Move } from '../src/engine/board.ts'
import { route } from '../src/engine/route.ts'
import { solve } from '../src/engine/solve.ts'
import { buildUnits } from '../src/engine/units.ts'
import { PUZZLES } from '../src/puzzles/index.ts'

// 決まった乱数（毎回同じ盤面で確かめる）
let seed = 12345
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const MOVES: Move[] = ['pull', 'push', 'hang']
const same = (a: Board, b: Board) => JSON.stringify(a) === JSON.stringify(b)

let failed = 0
let tried = 0
for (const p of PUZZLES) {
  const units = buildUnits(p.text)
  const sol = solve(p, units)!
  const starts: Board[] = [initialBoard(p, units.length)]
  for (let t = 0; t < 200; t++) {
    let b = initialBoard(p, units.length)
    const n = 1 + Math.floor(rand() * 30)
    for (let k = 0; k < n; k++) b = applyMove(p, units, b, Math.floor(rand() * (p.rows - 1)), MOVES[Math.floor(rand() * 3)]) ?? b
    starts.push(b)
  }
  for (const start of starts) {
    tried++
    let b = start
    let ok = false
    for (let k = 0; k < 200; k++) {
      if (same(b, sol.board)) {
        ok = true
        break
      }
      let next: Board | null = null
      try {
        const [first] = route(p, units, b, sol.board)
        if (first) next = applyMove(p, units, b, first[0], first[1])
      } catch {
        // 下で失敗として数える
      }
      if (!next) break
      b = next
    }
    if (!ok) {
      failed++
      if (failed <= 5) console.error(`NG ${p.id}: ${JSON.stringify(start)} からヒントでたどり着けない`)
    }
  }
}
if (failed) {
  console.error(`${failed} / ${tried} 盤面で失敗`)
  process.exit(1)
}
console.log(`ヒント: ${PUZZLES.length} 問 × ${tried / PUZZLES.length} 盤面、すべて最善解にたどり着く`)
