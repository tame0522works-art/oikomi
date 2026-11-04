/**
 * 最善の解と、比べるための「頭から直していく」解。
 * 最善の解は、行ごとの切れ目とぶら下げの組み合わせを動的計画法で全部調べる（行の乱れは行の中だけで決まるので分けて足せる）。
 */
import type { Board, Puzzle } from './board.ts'
import { evalLine } from './line.ts'
import { noLineStart } from './classes.ts'
import { inseparablePair, type Unit } from './units.ts'

export interface Solution {
  board: Board
  cost: number
  /** 最善と同じ乱れになる解の数（1 なら答えが1つに決まる） */
  ways: number
}

const EPS = 1e-6

export function solve(puzzle: Puzzle, units: Unit[]): Solution | null {
  const n = units.length
  const { rows, hangs, length } = puzzle
  // best[r][s][h]: r 行目を位置 s から始め、それまでにぶら下げを h 回使ったときの、残りの行の最小の乱れ
  type Cell = { cost: number; ways: number; end: number; hang: boolean }
  const memo = new Map<number, Cell | null>()
  const key = (r: number, s: number, h: number) => (r * (n + 1) + s) * (hangs + 1) + h

  const go = (r: number, s: number, h: number): Cell | null => {
    const k = key(r, s, h)
    if (memo.has(k)) return memo.get(k)!
    let best: Cell | null = null
    const last = r === rows - 1
    const consider = (e: number, hang: boolean) => {
      const line = evalLine(units, s, e, length, hang, last)
      if (line.violations.length) return
      const rest = last ? { cost: 0, ways: 1 } : go(r + 1, e, h + (hang ? 1 : 0))
      if (!rest) return
      const cost = line.cost + rest.cost
      if (!best || cost < best.cost - EPS) best = { cost, ways: rest.ways, end: e, hang }
      else if (Math.abs(cost - best.cost) <= EPS) best.ways += rest.ways
    }
    if (last) {
      consider(n, false)
    } else {
      // 1行に入るのは字詰め＋約物を縮めた分まで。全角の約物でも二分までしか縮まないので length*2 で十分
      for (let e = s + 1; e < n && e <= s + length * 2 + 1; e++) {
        consider(e, false)
        if (h < hangs) consider(e, true)
      }
    }
    memo.set(k, best)
    return best
  }

  const top = go(0, 0, 0)
  if (!top) return null
  const starts = [0]
  const hang: boolean[] = []
  let s = 0
  let h = 0
  for (let r = 0; r < rows; r++) {
    const c = go(r, s, h)!
    hang.push(c.hang)
    if (c.hang) h++
    s = c.end
    if (r + 1 < rows) starts.push(s)
  }
  return { board: { starts, hang }, cost: top.cost, ways: top.ways }
}

/**
 * 組版ソフトと同じく、頭から1行ずつ「ぶら下げ → 追い込み → 追い出し」の順で直した結果（kumi の lines.ts と同じ順）。
 * 行数は問題の行数に合うとは限らない。合わないか最善より乱れが大きければ、その問題は「先を読む」必要がある。
 */
export function greedy(puzzle: Puzzle, units: Unit[]): { starts: number[]; hang: boolean[]; cost: number; valid: boolean } {
  const n = units.length
  const { length } = puzzle
  const starts: number[] = []
  const hang: boolean[] = []
  let cost = 0
  let valid = true
  let hangsLeft = puzzle.hangs
  let s = 0
  const fits = (e: number, hg: boolean) => evalLine(units, s, e, length, hg, e === n)
  while (s < n) {
    starts.push(s)
    // 縮めずに入る最後の位置
    let k = s + 1
    while (k < n && fits(k + 1, false).squeeze === 0 && !fits(k + 1, false).violations.includes('overflow')) k++
    if (k >= n) {
      const line = fits(n, false)
      cost += line.cost
      if (line.violations.length) valid = false
      hang.push(false)
      break
    }
    // 行頭禁則は次の行の違反として出るので、次の行の頭も見る
    const ok = (e: number, hg: boolean) =>
      fits(e, hg).violations.length === 0 && (e >= n || (!noLineStart(units[e].cls) && !inseparablePair(units[e - 1], units[e])))
    let chosen: [number, boolean] | null = null
    if (ok(k, false)) chosen = [k, false]
    else if (hangsLeft > 0 && ok(k + 1, true)) chosen = [k + 1, true]
    else {
      for (let e = k + 1; e <= Math.min(n - 1, k + length) && !chosen; e++) if (ok(e, false)) chosen = [e, false]
      for (let e = k - 1; e > s && !chosen; e--) if (ok(e, false)) chosen = [e, false]
    }
    // どこで切っても禁則に触れるときは字数で切り、行き詰まったことにする
    if (!chosen) valid = false
    const [e, hg] = chosen ?? [k, false]
    if (hg) hangsLeft--
    cost += fits(e, hg).cost
    hang.push(hg)
    s = e
  }
  return { starts, hang, cost, valid }
}
