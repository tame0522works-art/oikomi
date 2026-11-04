/** 盤面を端末に出す（横書きで1行ずつ。ぶら下げは ｜ の外） */
import { evaluate, type Board, type Puzzle } from '../src/engine/board.ts'
import type { Unit } from '../src/engine/units.ts'

export function show(puzzle: Puzzle, units: Unit[], board: Board): string {
  const ev = evaluate(puzzle, units, board)
  return ev.lines
    .map((l) => {
      const body = units.slice(l.start, l.hang ? l.end - 1 : l.end).map((u) => u.ch).join('')
      const hung = l.hang ? units[l.end - 1].ch : ''
      const note = [l.squeeze ? `縮め ${l.squeeze.toFixed(2)}` : '', l.spread ? `字間 +${l.spread.toFixed(3)}` : '', ...l.violations].filter(Boolean).join(' ')
      return `  ${body}｜${hung}  ${note}`
    })
    .join('\n')
}
