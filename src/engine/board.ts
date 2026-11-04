/**
 * 盤面（1問の状態）と3つの操作。
 * 行数は問題で決まっていて、遊ぶ人は「行の切れ目」だけを動かす。切れ目 j は j 行目と j+1 行目の境目。
 */
import { evalLine, type LineEval } from './line.ts'
import { buildUnits, hangable, type Unit } from './units.ts'

export interface Puzzle {
  id: string
  text: string
  /** 1行の字詰め */
  length: number
  rows: number
  /** ぶら下げを使える回数 */
  hangs: number
}

export interface Board {
  /** 各行の先頭の位置（starts[0] = 0、長さ rows） */
  starts: number[]
  /** 行末に句読点をぶら下げているか（最後の行は常に false） */
  hang: boolean[]
}

export interface BoardEval {
  lines: LineEval[]
  cost: number
  violations: number
  hangsUsed: number
  solved: boolean
}

export type Move = 'pull' | 'push' | 'hang'

export function lineEnd(board: Board, units: Unit[], j: number): number {
  return j + 1 < board.starts.length ? board.starts[j + 1] : units.length
}

/** 字詰めを無視して、頭から字数で切っただけの最初の盤面 */
export function initialBoard(puzzle: Puzzle, n: number): Board {
  return {
    // 行が余る問題でも各行に1字は残す
    starts: Array.from({ length: puzzle.rows }, (_, j) => Math.min(j * puzzle.length, n - (puzzle.rows - j))),
    hang: Array.from({ length: puzzle.rows }, () => false),
  }
}

export function evaluate(puzzle: Puzzle, units: Unit[], board: Board): BoardEval {
  const lines: LineEval[] = []
  for (let j = 0; j < puzzle.rows; j++) {
    lines.push(evalLine(units, board.starts[j], lineEnd(board, units, j), puzzle.length, board.hang[j], j === puzzle.rows - 1))
  }
  const violations = lines.reduce((n, l) => n + l.violations.length, 0)
  const hangsUsed = board.hang.filter(Boolean).length
  return {
    lines,
    cost: lines.reduce((c, l) => c + l.cost, 0),
    violations,
    hangsUsed,
    solved: violations === 0 && hangsUsed <= puzzle.hangs,
  }
}

/**
 * 切れ目 j（j 行目の行末）を動かす。動かせないときは null。
 * - pull（追い込む）: 次の行の頭の1字を j 行目に入れる
 * - push（追い出す）: j 行目の最後の1字を次の行へ送る。ぶら下げていればそれを戻す
 * - hang（ぶら下げ）: 次の行の頭の句読点を j 行目の外にぶら下げる
 */
export function applyMove(puzzle: Puzzle, units: Unit[], board: Board, j: number, move: Move): Board | null {
  if (j < 0 || j >= puzzle.rows - 1) return null
  const starts = [...board.starts]
  const hang = [...board.hang]
  const start = starts[j]
  const boundary = starts[j + 1]
  const nextEnd = lineEnd(board, units, j + 1)
  switch (move) {
    case 'pull':
      if (hang[j] || boundary + 1 >= nextEnd) return null
      starts[j + 1]++
      break
    case 'push':
      if (hang[j]) hang[j] = false
      else if (boundary - 1 <= start) return null
      starts[j + 1]--
      break
    case 'hang':
      if (hang[j] || boundary + 1 >= nextEnd || !hangable(units[boundary])) return null
      if (board.hang.filter(Boolean).length >= puzzle.hangs) return null
      starts[j + 1]++
      hang[j] = true
      break
  }
  return { starts, hang }
}

export function unitsOf(puzzle: Puzzle): Unit[] {
  return buildUnits(puzzle.text)
}
