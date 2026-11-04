/**
 * 1行の評価。行の切れ目は遊ぶ人が決めるので、ここでは「その切れ目で組んだらどうなるか」だけを出す。
 * 字詰めより長ければ約物の空きを縮め（追い込み）、短ければ字間に配る（追い出しの結果）。
 */
import { noLineEnd, noLineStart } from './classes.ts'
import { hangable, inseparablePair, unitWidth, type Unit } from './units.ts'

export type Violation =
  | 'line-start' // 行頭禁則（。、」っー など）
  | 'line-end' // 行末禁則（「（ など）
  | 'split-pair' // ――・…… の組を分けた
  | 'overflow' // 縮めても字詰めに収まらない
  | 'bad-hang' // 句読点でない字をぶら下げた
  | 'empty'

export interface LineEval {
  start: number
  end: number
  hang: boolean
  violations: Violation[]
  /** 縮めた長さ（全角 = 1） */
  squeeze: number
  /** 字間に配った1か所あたりの長さ（全角 = 1） */
  spread: number
  /** この行の乱れ（0 が理想） */
  cost: number
  /** 字ごとの位置（行頭からの全角単位）。ぶら下げた字は字詰めの外 */
  positions: number[]
}

const EPS = 1e-6
/**
 * 乱れの重み。字間が全角の 1/10 ずつ空くと 1、約物の空きを二分縮めると 2.5。
 * JLREQ は追い出しより追い込みを先に試すので、縮めるほうを軽くしている
 */
const SPREAD_WEIGHT = 100
const SQUEEZE_WEIGHT = 10

/**
 * units[start, end) を1行に組む。hang なら end-1 の字を行末の外にぶら下げる。
 * last は最後の行（字間に配らず行頭そろえにする）。
 */
export function evalLine(units: Unit[], start: number, end: number, length: number, hang: boolean, last: boolean): LineEval {
  const violations: Violation[] = []
  const contentEnd = hang ? end - 1 : end
  if (contentEnd <= start) {
    return { start, end, hang, violations: ['empty'], squeeze: 0, spread: 0, cost: 0, positions: [] }
  }
  if (hang && !hangable(units[end - 1])) violations.push('bad-hang')
  if (start > 0) {
    if (noLineStart(units[start].cls)) violations.push('line-start')
    if (inseparablePair(units[start - 1], units[start])) violations.push('split-pair')
  }
  if (end < units.length && noLineEnd(units[end - 1].cls)) violations.push('line-end')

  // 行頭の始め括弧は天付き、行末の約物の後ろの空きは取る
  const before = (i: number) => (i === start ? 0 : units[i].before)
  const after = (i: number) => (i === contentEnd - 1 ? 0 : units[i].after)
  const widths: number[] = []
  let natural = 0
  let shrinkable = 0
  for (let i = start; i < contentEnd; i++) {
    const w = unitWidth(units[i], before(i), after(i))
    widths.push(w)
    natural += w
    // 句点の後ろは縮めない（JLREQ の既定）
    if (units[i].cls !== 'period') shrinkable += after(i)
    shrinkable += before(i)
  }

  let squeeze = 0
  let spread = 0
  let cost = 0
  const gaps: boolean[] = widths.map(() => false)
  if (natural > length + EPS) {
    squeeze = natural - length
    if (squeeze > shrinkable + EPS) violations.push('overflow')
    // 位置は縮めた分を空きのある字に比で配る（見た目用。乱れは squeeze だけで決まる）
    const ratio = shrinkable > 0 ? Math.min(1, squeeze / shrinkable) : 0
    for (let i = start; i < contentEnd; i++) {
      const u = units[i]
      const cut = (before(i) + (u.cls !== 'period' ? after(i) : 0)) * ratio
      widths[i - start] -= cut
    }
    cost = SQUEEZE_WEIGHT * squeeze * squeeze
  } else if (!last && natural < length - EPS) {
    let count = 0
    for (let i = start + 1; i < contentEnd; i++) {
      if (inseparablePair(units[i - 1], units[i])) continue
      gaps[i - start] = true
      count++
    }
    const room = length - natural
    if (count === 0) {
      // 1字だけの行など。字間がないので行末が空いたまま
      cost = SPREAD_WEIGHT * room * room
    } else {
      spread = room / count
      cost = SPREAD_WEIGHT * spread * spread
    }
  }

  const positions: number[] = []
  let pos = 0
  for (let k = 0; k < widths.length; k++) {
    if (gaps[k]) pos += spread
    positions.push(pos)
    pos += widths[k]
  }
  if (hang) positions.push(length)
  return { start, end, hang, violations, squeeze, spread, cost, positions }
}
