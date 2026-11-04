/**
 * 問題づくりの下調べ。本文と字詰めを渡すと、行数・ぶら下げの回数ごとに
 * 解けるか・最善の乱れ・解の数・頭から直したときの行数と乱れを出す。
 *   npx tsx tools/design.ts 12 "本文"
 */
import { evaluate, initialBoard, type Puzzle } from '../src/engine/board.ts'
import { greedy, solve } from '../src/engine/solve.ts'
import { buildUnits } from '../src/engine/units.ts'
import { show } from './show.ts'

const [lengthArg, text] = process.argv.slice(2)
const length = Number(lengthArg)
const units = buildUnits(text)
console.log(`${units.length} 字、字詰め ${length}`)
const minRows = Math.ceil(units.length / (length + 1))
for (let rows = minRows; rows <= minRows + 2; rows++) {
  for (let hangs = 0; hangs <= 2; hangs++) {
    const puzzle: Puzzle = { id: 'x', text, length, rows, hangs }
    const sol = solve(puzzle, units)
    const g = greedy(puzzle, units)
    const init = evaluate(puzzle, units, initialBoard(puzzle, units.length))
    console.log(
      `rows=${rows} hangs=${hangs}: ` +
        (sol ? `最善 ${sol.cost.toFixed(2)}（${sol.ways} 通り）` : '解けない') +
        `、頭から ${g.starts.length} 行 ${g.valid ? g.cost.toFixed(2) : '行き詰まる'}、最初の違反 ${init.violations}`,
    )
    if (sol && process.env.SHOW) console.log(show(puzzle, units, sol.board))
  }
}
