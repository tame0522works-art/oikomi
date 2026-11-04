/**
 * 縦書きの段を SVG で描く。座標は全角 = 1（viewBox も同じ単位）。
 * 字は元の本文での位置を key にしているので、行の切れ目を動かすと字が隣の行へ滑って移る。
 */
import glyphs from '../glyphs.json'
import type { BoardEval } from '../engine/board.ts'
import type { Violation } from '../engine/line.ts'
import type { Unit } from '../engine/units.ts'

const GLYPHS = glyphs as { [ch: string]: string }

/** 行の送り（行の中心どうしの間隔、全角 = 1） */
export const PITCH = 1.5
const TOP = 0.3
/** ぶら下げの分として字詰めの下に空けておく長さ */
const HANG_ROOM = 1.2

export function boardSize(length: number, rows: number) {
  return { width: rows * PITCH, height: TOP + length + HANG_ROOM }
}

interface Props {
  units: Unit[]
  ev: BoardEval
  length: number
  rows: number
  selected: number | null
  /** ヒントで指している行 */
  hintLine: number | null
  onSelect: (j: number) => void
}

/** 違反をどの字に付けるか */
function markedChars(ev: BoardEval): Map<number, Violation> {
  const marks = new Map<number, Violation>()
  for (const l of ev.lines) {
    for (const v of l.violations) {
      if (v === 'line-start' || v === 'split-pair') marks.set(l.start, v)
      if (v === 'line-end') marks.set(l.end - 1, v)
      if (v === 'bad-hang') marks.set(l.end - 1, v)
    }
  }
  return marks
}

export function Column({ units, ev, length, rows, selected, hintLine, onSelect }: Props) {
  const { width, height } = boardSize(length, rows)
  const marks = markedChars(ev)
  const colX = (j: number) => width - (j + 0.5) * PITCH

  return (
    <svg className="board" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="盤面">
      {/* 字詰めの枠と、行ごとの選ぶ範囲 */}
      {ev.lines.map((l, j) => {
        const x = colX(j)
        const overflow = l.violations.includes('overflow') || l.violations.includes('empty')
        return (
          <g key={`col${j}`}>
            <rect
              className={`col${selected === j ? ' selected' : ''}${hintLine === j ? ' hinted' : ''}${overflow ? ' overflow' : ''}`}
              x={x - PITCH / 2 + 0.06}
              y={0}
              width={PITCH - 0.12}
              height={height}
              rx={0.15}
              onClick={() => onSelect(j)}
              role="button"
              aria-label={`${j + 1}行目を選ぶ`}
              aria-pressed={selected === j}
            />
            {Array.from({ length }, (_, k) => (
              <rect key={k} className="cell" x={x - 0.5} y={TOP + k} width={1} height={1} />
            ))}
          </g>
        )
      })}
      <line className="limit" x1={0} x2={width} y1={TOP + length} y2={TOP + length} />

      {/* 字 */}
      {ev.lines.flatMap((l, j) =>
        l.positions.map((pos, k) => {
          const i = l.start + k
          const u = units[i]
          const mark = marks.get(i)
          const x = colX(j) - 0.5
          const y = TOP + pos
          return (
            <g key={i} className="glyph" data-i={i} style={{ transform: `translate(${x}px, ${y}px)` }}>
              {/* 約物は字面が枠の半分なので、印も字面の分だけ */}
              {mark && <rect className="mark" x={0.02} y={u.akiBefore + 0.02} width={0.96} height={1 - u.akiBefore - u.akiAfter - 0.04} rx={0.12} />}
              <path d={GLYPHS[u.ch] ?? ''} />
            </g>
          )
        }),
      )}
    </svg>
  )
}
