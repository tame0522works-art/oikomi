import { useMemo, useState } from 'react'
import { applyMove, evaluate, initialBoard, unitsOf, type Board, type BoardEval, type Move, type Puzzle } from './engine/board.ts'
import type { Violation } from './engine/line.ts'
import { displayCost, stars } from './engine/score.ts'
import { solve } from './engine/solve.ts'
import type { Unit } from './engine/units.ts'
import { PUZZLES } from './puzzles/index.ts'
import { loadProgress, saveRecord, type Progress } from './storage.ts'
import { Column } from './ui/Column.tsx'

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [current, setCurrent] = useState<number | null>(null)

  if (current === null) return <Menu progress={progress} onPick={setCurrent} />
  const puzzle = PUZZLES[current]
  return (
    <Play
      key={puzzle.id}
      index={current}
      puzzle={puzzle}
      best={progress[puzzle.id]}
      onSolved={(rec) => setProgress((p) => saveRecord(p, puzzle.id, rec))}
      onBack={() => setCurrent(null)}
      onNext={current + 1 < PUZZLES.length ? () => setCurrent(current + 1) : null}
    />
  )
}

function Menu({ progress, onPick }: { progress: Progress; onPick: (i: number) => void }) {
  const total = Object.values(progress).reduce((n, r) => n + r.stars, 0)
  return (
    <main className="menu">
      <header>
        <h1>oikomi</h1>
        <p className="lead">縦書きの行頭に「。」や「っ」が来ないよう、行の切れ目を動かして組み直すパズル。</p>
        <p className="muted">
          ★ {total} / {PUZZLES.length * 3}
        </p>
      </header>
      <ol className="levels">
        {PUZZLES.map((p, i) => {
          const rec = progress[p.id]
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(i)} aria-label={`${i + 1}問目${rec ? `、★${rec.stars}` : ''}`}>
                <span className="num">{i + 1}</span>
                <span className="stars">{rec ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '☆☆☆'}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <footer className="muted">
        字形は BIZ UD明朝（<a href="./OFL.txt">SIL Open Font License 1.1</a>）。記録はこの端末のブラウザにだけ保存します。
      </footer>
    </main>
  )
}

interface PlayProps {
  index: number
  puzzle: Puzzle
  best: { stars: number; cost: number } | undefined
  onSolved: (rec: { stars: 1 | 2 | 3; cost: number }) => void
  onBack: () => void
  onNext: (() => void) | null
}

function Play({ index, puzzle, best, onSolved, onBack, onNext }: PlayProps) {
  const units = useMemo(() => unitsOf(puzzle), [puzzle])
  const optimum = useMemo(() => solve(puzzle, units)?.cost ?? 0, [puzzle, units])
  const [history, setHistory] = useState<Board[]>(() => [initialBoard(puzzle, units.length)])
  const [selected, setSelected] = useState<number | null>(0)
  const [dismissed, setDismissed] = useState(false)
  const board = history[history.length - 1]
  const ev = useMemo(() => evaluate(puzzle, units, board), [puzzle, units, board])
  const star = ev.solved ? stars(ev.cost, optimum) : null

  const move = (m: Move) => {
    if (selected === null) return
    const next = applyMove(puzzle, units, board, selected, m)
    if (!next) return
    setHistory((h) => [...h, next])
    setDismissed(false)
    const nextEv = evaluate(puzzle, units, next)
    if (nextEv.solved) onSolved({ stars: stars(nextEv.cost, optimum), cost: nextEv.cost })
  }
  const can = (m: Move) => selected !== null && applyMove(puzzle, units, board, selected, m) !== null
  const lastRow = selected === puzzle.rows - 1

  return (
    <main className="play">
      <header className="top">
        <button type="button" className="ghost" onClick={onBack}>
          ← 一覧
        </button>
        <span className="title">{index + 1}問目</span>
        <span className="meters">
          <span>
            {/* 禁則が残っているうちは乱れを比べても意味がないので出さない */}
            乱れ <b>{ev.violations ? '—' : displayCost(ev.cost)}</b>
          </span>
          <span>
            ぶら下げ <b>{puzzle.hangs - ev.hangsUsed}</b>
          </span>
        </span>
      </header>

      <p className="rule">
        {puzzle.length}字×{puzzle.rows}行に収める{best ? `　最高 ★${best.stars}（乱れ ${displayCost(best.cost)}）` : ''}
      </p>

      <div className="stage">
        <Column units={units} ev={ev} length={puzzle.length} rows={puzzle.rows} selected={selected} onSelect={setSelected} />
      </div>

      <p className="status" aria-live="polite">
        {ev.solved ? `禁則はすべて解消。最善の乱れは ${displayCost(optimum)}。` : describe(ev, units)}
      </p>

      <div className="controls">
        <p className="target">
          {selected === null ? '行をタップして選ぶ' : lastRow ? `${selected + 1}行目（最後の行）は、前の行の操作で動かす` : `${selected + 1}行目の行末を`}
        </p>
        <div className="moves">
          <button type="button" onClick={() => move('pull')} disabled={!can('pull')}>
            追い込む
            <small>次の行の頭を入れる</small>
          </button>
          <button type="button" onClick={() => move('push')} disabled={!can('push')}>
            追い出す
            <small>行末の字を送る</small>
          </button>
          <button type="button" onClick={() => move('hang')} disabled={!can('hang')}>
            ぶら下げ
            <small>句読点を外に出す</small>
          </button>
        </div>
        <div className="sub">
          <button type="button" className="ghost" onClick={() => setHistory((h) => h.slice(0, -1))} disabled={history.length < 2}>
            1手戻す
          </button>
          <button type="button" className="ghost" onClick={() => setHistory((h) => [h[0]])} disabled={history.length < 2}>
            最初から
          </button>
        </div>
      </div>

      {star && !dismissed && (
        <div className="clear" role="dialog" aria-label="完成">
          <p className="big">{'★'.repeat(star) + '☆'.repeat(3 - star)}</p>
          <p>
            乱れ {displayCost(ev.cost)}（最善 {displayCost(optimum)}）
          </p>
          <p className="muted">{star === 3 ? 'これ以上は揃えられません。' : 'もっと揃えられます。'}</p>
          <div className="row">
            <button type="button" className="ghost" onClick={() => setDismissed(true)}>
              {star === 3 ? '盤面を見る' : '続けて揃える'}
            </button>
            {onNext ? (
              <button type="button" onClick={onNext}>
                次の問題へ
              </button>
            ) : (
              <button type="button" onClick={onBack}>
                一覧へ
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

const VIOLATION_TEXT: { [v in Violation]: (ch: string) => string } = {
  'line-start': (ch) => `行頭に「${ch}」が来ている`,
  'line-end': (ch) => `行末に「${ch}」が来ている`,
  'split-pair': (ch) => `「${ch}${ch}」が2行に分かれている`,
  overflow: () => '縮めても字詰めに入らない',
  'bad-hang': (ch) => `「${ch}」はぶら下げられない`,
  empty: () => '空の行がある',
}

function describe(ev: BoardEval, units: Unit[]): string {
  const problems: string[] = []
  ev.lines.forEach((l, j) => {
    for (const v of l.violations) {
      const at = v === 'line-end' || v === 'bad-hang' ? l.end - 1 : l.start
      problems.push(`${j + 1}行目: ${VIOLATION_TEXT[v](units[at]?.ch ?? '')}`)
    }
  })
  return problems.length ? problems.slice(0, 2).join('　') + (problems.length > 2 ? `　ほか ${problems.length - 2} か所` : '') : ''
}
