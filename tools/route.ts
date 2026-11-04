/**
 * ある盤面から目当ての盤面まで、画面の操作（行を選んで 追い込む・追い出す・ぶら下げ）だけでたどる手順を作る。
 * 最善解が本当に手で作れるかの確認（check:puzzles）と、画面テストで最善解まで操作するのに使う。
 * 先頭の行から順に、行末の切れ目を目当ての位置まで動かす。次の行が空になって追い込めないときは、先に次の行へ追い込む。
 */
import { applyMove, type Board, type Move, type Puzzle } from '../src/engine/board.ts'
import type { Unit } from '../src/engine/units.ts'

export type Step = [line: number, move: Move]

export function route(puzzle: Puzzle, units: Unit[], from: Board, to: Board): Step[] {
  const steps: Step[] = []
  let board = from
  const step = (j: number, m: Move): boolean => {
    const next = applyMove(puzzle, units, board, j, m)
    if (!next) return false
    board = next
    steps.push([j, m])
    return true
  }
  const pull = (j: number): boolean => {
    if (step(j, 'pull')) return true
    // 次の行が1字しかない。次の行へ先に1字追い込んでから
    if (j + 1 < puzzle.rows - 1 && pull(j + 1)) return step(j, 'pull')
    return false
  }

  for (let j = 0; j < puzzle.rows - 1; j++) {
    if (board.hang[j]) step(j, 'push')
    const content = to.hang[j] ? to.starts[j + 1] - 1 : to.starts[j + 1]
    while (board.starts[j + 1] > content) if (!step(j, 'push')) throw new Error(`${j + 1}行目を追い出せない`)
    while (board.starts[j + 1] < content) if (!pull(j)) throw new Error(`${j + 1}行目に追い込めない`)
    if (to.hang[j] && !step(j, 'hang')) {
      // ぶら下げる字の後ろが次の行の最後の1字だと、ぶら下げで次の行が空になる。先に次の行へ追い込む
      if (!pull(j + 1) || !step(j, 'hang')) throw new Error(`${j + 1}行目でぶら下げられない`)
    }
  }
  return steps
}
