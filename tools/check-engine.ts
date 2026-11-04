/** エンジンの確認: 行の評価・操作・最善解を、手で答えの分かる例で確かめる */
import { applyMove, evaluate, initialBoard, type Board, type Puzzle } from '../src/engine/board.ts'
import { evalLine } from '../src/engine/line.ts'
import { stars } from '../src/engine/score.ts'
import { solve } from '../src/engine/solve.ts'
import { buildUnits } from '../src/engine/units.ts'

let failed = 0
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'ok' : 'NG'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

// 行の評価
{
  const u = buildUnits('あいうえお。かきく')
  check('行頭の句点は違反', evalLine(u, 5, 9, 5, false, true).violations.includes('line-start'))
  check('ちょうど入る行は乱れ 0', evalLine(u, 0, 5, 5, false, false).cost === 0)
  const four = evalLine(u, 0, 4, 5, false, false)
  check('1字足りない行は字間に配る', near(four.spread, 1 / 3), String(four.spread))
  check('最後の行は字間に配らない', evalLine(u, 6, 9, 5, false, true).cost === 0)
  const hung = evalLine(u, 0, 6, 5, true, false)
  check('句点のぶら下げは字詰めの外', hung.violations.length === 0 && hung.cost === 0 && hung.positions[5] === 5)
  check('句読点以外はぶら下げられない', evalLine(u, 0, 5, 4, true, false).violations.includes('bad-hang'))
}
{
  const u = buildUnits('かれは「あ」と')
  check('行末の始め括弧は違反', evalLine(u, 0, 4, 4, false, false).violations.includes('line-end'))
  // 「あ」と は行頭の始め括弧が天付きで 3.5。終わり括弧の後ろの二分を縮めれば 3 に入る
  const line = evalLine(u, 3, 7, 3, false, false)
  check('約物の空きを縮める（追い込み）', line.violations.length === 0 && near(line.squeeze, 0.5), `${line.squeeze} ${line.violations}`)
  const tight = evalLine(u, 3, 7, 2.5, false, false)
  check('縮めても入らなければ overflow', tight.violations.includes('overflow'))
}
{
  const u = buildUnits('ああ――いい')
  check('――を分けるのは違反', evalLine(u, 3, 6, 3, false, true).violations.includes('split-pair'))
}

// 操作
{
  const p: Puzzle = { id: 't', text: 'あいうえおかきくけこ。さしすせそ', length: 5, rows: 3, hangs: 1 }
  const u = buildUnits(p.text)
  const b0 = initialBoard(p, u.length)
  check('最初は字数で切る', b0.starts.join() === '0,5,10')
  check('最初の盤面は違反あり', evaluate(p, u, b0).violations > 0)
  const pulled = applyMove(p, u, b0, 1, 'pull')!
  check('追い込むと次の行の頭が入る', pulled.starts[2] === 11)
  const hung = applyMove(p, u, b0, 1, 'hang')!
  check('ぶら下げ', hung.starts[2] === 10 + 1 && hung.hang[1])
  check('ぶら下げの回数を超えられない', applyMove({ ...p, hangs: 0 }, u, b0, 1, 'hang') === null)
  const back = applyMove(p, u, hung, 1, 'push')!
  check('追い出すとぶら下げが戻る', back.starts[2] === 10 && !back.hang[1])
  check('最後の行の後ろの切れ目はない', applyMove(p, u, b0, 2, 'pull') === null)
  const one: Board = { starts: [0, 1, 10], hang: [false, false, false] }
  check('1字の行は追い出せない', applyMove(p, u, one, 0, 'push') === null)
}

// 最善解
{
  const p: Puzzle = { id: 't', text: 'あいうえおかきくけこ。さしすせそ', length: 5, rows: 3, hangs: 1 }
  const u = buildUnits(p.text)
  const sol = solve(p, u)!
  const ev = evaluate(p, u, sol.board)
  check('最善解は違反なし', ev.solved, ev.lines.map((l) => l.violations.join('/')).join(' '))
  check('最善解の乱れが evaluate と一致', near(ev.cost, sol.cost))
  check('ぶら下げを使うのが最善', sol.board.hang[1] && near(sol.cost, 0), JSON.stringify(sol.board))
  const none = solve({ ...p, hangs: 0 }, u)
  check('ぶら下げなしでは解けない', none === null)
  check('解けない問題は null', solve({ ...p, rows: 2, hangs: 0 }, u) === null)
}

check('★3 は最善と同じ', stars(4, 4) === 3)
check('★2', stars(7, 4) === 2)
check('★1', stars(20, 4) === 1)

if (failed) {
  console.error(`${failed} 件失敗`)
  process.exit(1)
}
console.log('全件 OK')
