// 画面操作のテスト。公開と同じ設定でビルドしたもの（CSP 入り）をローカルで配信し、画面なしの Chrome に
// 本物のマウス・タッチの入力を送って、行の選択・3つの操作・違反の表示・★・記録の保存・通信の制限を確かめる。
// `npm run e2e` で実行する（先に dist-e2e へビルドしてから、このスクリプトが配信とブラウザを立ち上げる）。
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { initialBoard } from '../src/engine/board.ts'
import { displayCost } from '../src/engine/score.ts'
import { solve } from '../src/engine/solve.ts'
import { buildUnits } from '../src/engine/units.ts'
import { PUZZLES } from '../src/puzzles/index.ts'
import { Browser, sleep, type Page, type Viewport } from './cdp.ts'
import { route } from '../src/engine/route.ts'

const PORT = 4209
const BASE = `http://127.0.0.1:${PORT}/`
const DESKTOP: Viewport = { width: 1280, height: 860 }
const PHONE: Viewport = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, touch: true }
const FAILURES = 'e2e-failures'
type Input = 'mouse' | 'touch'

class Ui {
  readonly page: Page
  readonly input: Input
  constructor(page: Page, input: Input) {
    this.page = page
    this.input = input
  }

  async open() {
    await this.page.goto(BASE)
    await this.page.waitFor(`document.querySelector('.levels button')`, '一覧の表示')
  }

  text(selector: string) {
    return this.page.run<string>(`return (document.querySelector(${JSON.stringify(selector)})?.textContent ?? '').replace(/\\s+/g, ' ').trim()`)
  }

  private async tap(c: { x: number; y: number }) {
    if (this.input === 'touch') {
      await this.page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] })
      await sleep(50)
      await this.page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      // 指を離してすぐの次のタップは Chrome が click にしないことがある（kakijun で分かったこと）
      await sleep(350)
    } else {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await this.page.send('Input.dispatchMouseEvent', { type, ...c, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
      }
      await sleep(60)
    }
  }

  private async center(selectorJs: string, label: string) {
    const c = await this.page.run<{ x: number; y: number } | null>(`
      const el = ${selectorJs};
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `)
    assert.ok(c, `${label}がない`)
    return c
  }

  /** 見えている文字（空白を除く）か aria-label でボタンを押す */
  async press(label: string) {
    const L = JSON.stringify(label)
    await this.tap(await this.center(`[...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g, '').startsWith(${L}) || b.getAttribute('aria-label') === ${L})`, `「${label}」のボタン`))
  }

  async disabled(label: string) {
    return this.page.run<boolean>(`return [...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g, '').startsWith(${JSON.stringify(label)})).disabled`)
  }

  /** 行を選ぶ（0 始まり） */
  async line(j: number) {
    // 行の中ほど（字の上）を押す。字は pointer-events: none なので、下にある行の枠に届く
    const c = await this.center(`document.querySelector('rect.col[aria-label="${j + 1}行目を選ぶ"]')`, `${j + 1}行目`)
    await this.tap(c)
    assert.equal(await this.page.run(`return document.querySelector('rect.col[aria-pressed="true"]')?.getAttribute('aria-label')`), `${j + 1}行目を選ぶ`)
  }

  marks() {
    return this.page.run<number>(`return document.querySelectorAll('.board .mark').length`)
  }

  /** 1行目から順に、各行の字を並べたもの（ぶら下げも含む） */
  async lines() {
    return this.page.run<string[]>(`
      const cols = [...document.querySelectorAll('.board rect.col')].map(r => ({ x: +r.getAttribute('x') + +r.getAttribute('width') / 2 }));
      const glyphs = [...document.querySelectorAll('.board .glyph')].map(g => {
        const m = g.style.transform.match(/translate\\(([-\\d.]+)px, ([-\\d.]+)px\\)/);
        return { x: +m[1] + 0.5, y: +m[2], i: g.dataset.i };
      });
      return cols.map(c => glyphs.filter(g => Math.abs(g.x - c.x) < 0.1).sort((a, b) => a.y - b.y).map(g => g.i).join(','));
    `)
  }

  meter(name: string) {
    return this.page.run<string>(`return [...document.querySelectorAll('.meters span')].find(s => s.textContent.startsWith(${JSON.stringify(name)})).querySelector('b').textContent`)
  }
}

interface Scenario {
  name: string
  viewport?: Viewport
  setup?: string
  run(ui: Ui): Promise<void>
}

/** 最善解までの手順を画面で操作する */
async function solveByUi(ui: Ui, index: number) {
  const p = PUZZLES[index]
  const units = buildUnits(p.text)
  const sol = solve(p, units)!
  const steps = route(p, units, initialBoard(p, units.length), sol.board)
  const label = { pull: '追い込む', push: '追い出す', hang: 'ぶら下げ' } as const
  let selected = 0
  for (const [j, m] of steps) {
    // 途中で完成の案内が出たら閉じて続ける
    if (await ui.page.run<boolean>(`return !!document.querySelector('.clear')`)) await ui.press('続けて揃える')
    if (j !== selected) {
      await ui.line(j)
      selected = j
    }
    await ui.press(label[m])
  }
  return sol.cost
}

const scenarios: Scenario[] = [
  {
    name: '一覧: 20問・★0、フォントのライセンスへのリンク',
    async run(ui) {
      await ui.open()
      assert.equal(await ui.page.run<number>(`return document.querySelectorAll('.levels button').length`), 20)
      assert.match(await ui.text('.menu header .muted'), /★ 0 \/ 60/)
      assert.match(await ui.text('.menu footer'), /BIZ UD明朝.*SIL Open Font License 1\.1/)
      const href = await ui.page.run<string>(`return document.querySelector('.menu footer a').href`)
      const ofl = await fetch(href).then((r) => r.text())
      assert.match(ofl, /SIL OPEN FONT LICENSE Version 1\.1/)
    },
  },
  {
    name: 'スマホの指で1問目: 違反の表示 → ぶら下げで★2 → 追い込みで★3、記録が残る',
    viewport: PHONE,
    async run(ui) {
      await ui.open()
      await ui.press('1問目')
      assert.equal(await ui.marks(), 1)
      assert.match(await ui.text('.status'), /4行目: 行頭に「、」が来ている/)
      assert.equal(await ui.meter('乱れ'), '—')
      assert.equal(await ui.meter('ぶら下げ'), '1')
      await ui.line(2)
      await ui.press('ぶら下げ')
      assert.equal(await ui.marks(), 0)
      assert.equal(await ui.meter('ぶら下げ'), '0')
      assert.match(await ui.text('.clear'), /★★☆.*乱れ 16（最善 0）.*もっと揃えられます/)
      await ui.press('続けて揃える')
      assert.equal(await ui.disabled('ぶら下げ'), true, 'ぶら下げの回数を使い切ったのに押せる')
      await ui.line(3)
      await ui.press('追い込む')
      assert.match(await ui.text('.clear'), /★★★.*乱れ 0（最善 0）.*これ以上は揃えられません/)
      await ui.press('←一覧')
      assert.match(await ui.text('.menu header .muted'), /★ 3 \/ 60/)
      // 読み込み直しても残っている
      await ui.open()
      assert.equal(await ui.page.run(`return document.querySelector('.levels button').getAttribute('aria-label')`), '1問目、★3')
    },
  },
  {
    name: '記録は良いときだけ書き換える: ★3 のあとで ★2 にしても ★3 のまま',
    async run(ui) {
      await ui.open()
      await ui.press('1問目')
      await ui.line(2)
      await ui.press('ぶら下げ')
      await ui.press('続けて揃える')
      await ui.line(3)
      await ui.press('追い込む')
      await ui.press('盤面を見る')
      await ui.press('追い出す')
      assert.match(await ui.text('.clear'), /★★☆/)
      await ui.press('←一覧')
      assert.match(await ui.text('.menu header .muted'), /★ 3 \/ 60/)
    },
  },
  {
    name: '1手戻す・最初から・最後の行では操作できない',
    async run(ui) {
      await ui.open()
      await ui.press('2問目')
      const first = await ui.lines()
      assert.equal(await ui.disabled('1手戻す'), true)
      await ui.press('追い出す')
      const pushed = await ui.lines()
      assert.notDeepEqual(pushed, first)
      // 1行目の最後の字が2行目の頭へ移る
      assert.equal(pushed[1].split(',')[0], first[0].split(',').at(-1))
      await ui.press('追い込む')
      await ui.press('追い込む')
      await ui.press('1手戻す')
      assert.deepEqual(await ui.lines(), first)
      await ui.press('最初から')
      assert.deepEqual(await ui.lines(), first)
      assert.equal(await ui.disabled('最初から'), true)
      await ui.line(PUZZLES[1].rows - 1)
      for (const label of ['追い込む', '追い出す', 'ぶら下げ']) assert.equal(await ui.disabled(label), true, `最後の行で「${label}」が押せる`)
      assert.match(await ui.text('.controls .target'), /最後の行/)
    },
  },
  {
    name: '20問目を最善解まで操作して★3、乱れの表示が最善と一致する',
    async run(ui) {
      await ui.open()
      await ui.press('20問目')
      const cost = await solveByUi(ui, 19)
      assert.match(await ui.text('.clear'), new RegExp(`★★★.*乱れ ${displayCost(cost)}（最善 ${displayCost(cost)}）`))
      assert.equal(await ui.meter('乱れ'), String(displayCost(cost)))
      await ui.press('一覧へ')
      assert.match(await ui.text('.menu header .muted'), /★ 3 \/ 60/)
    },
  },
  {
    name: 'スマホの指で9問目をヒントだけで解く: 光った行と光ったボタンを押し続けると★3',
    viewport: PHONE,
    async run(ui) {
      await ui.open()
      await ui.press('9問目')
      for (let k = 0; k < 40; k++) {
        if (await ui.page.run<boolean>(`return !!document.querySelector('.clear')`)) {
          if (/★★★/.test(await ui.text('.clear'))) break
          await ui.press('続けて揃える')
        }
        await ui.press('ヒント')
        const hint = await ui.text('.hint-text')
        const m = hint.match(/ヒント: ([0-9]+)行目の行末を「(.+)」/)
        assert.ok(m, `ヒントの文が読めない: ${hint}`)
        // 光っている行と、文で言っている行が同じ
        assert.equal(await ui.page.run(`return document.querySelector('rect.col.hinted')?.getAttribute('aria-label')`), `${m[1]}行目を選ぶ`)
        assert.ok((await ui.text('.moves button.hinted')).startsWith(m[2]), '光っているボタンが文と違う')
        await ui.press(m[2])
      }
      assert.match(await ui.text('.clear'), /★★★/)
      await ui.press('盤面を見る')
      await ui.press('ヒント')
      assert.equal(await ui.text('.hint-text'), 'ヒント: いまの組み方が最善です')
    },
  },
  {
    name: '完成の案内から次の問題へ進める',
    async run(ui) {
      await ui.open()
      await ui.press('3問目')
      await solveByUi(ui, 2)
      await ui.press('次の問題へ')
      assert.equal(await ui.text('.top .title'), '4問目')
    },
  },
  {
    name: '保存できないブラウザでも遊べる（記録は残らない）',
    setup: `Storage.prototype.getItem = () => { throw new Error('blocked') }; Storage.prototype.setItem = () => { throw new Error('blocked') };`,
    async run(ui) {
      await ui.open()
      await ui.press('1問目')
      await ui.line(2)
      await ui.press('ぶら下げ')
      assert.match(await ui.text('.clear'), /★★☆/)
      await ui.press('←一覧')
      // 画面の中では覚えているが、読み込み直すと消える
      assert.match(await ui.text('.menu header .muted'), /★ 2 \/ 60/)
      await ui.open()
      assert.match(await ui.text('.menu header .muted'), /★ 0 \/ 60/)
    },
  },
  {
    name: '公開版の CSP: 通信は拒否し、すべて同じ場所から読む',
    async run(ui) {
      await ui.open()
      const csp = await ui.page.run<string>(`return document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? ''`)
      assert.match(csp, /connect-src 'none'/)
      const files = await ui.page.run<string[]>(`return performance.getEntriesByType('resource').map(e => e.name)`)
      assert.ok(files.every((f) => f.startsWith(BASE)), `別の場所から読んでいる: ${files.join(', ')}`)
      const blocked = await ui.page.run<boolean>(`try { await fetch('${BASE}'); return false } catch { return true }`)
      assert.ok(blocked, 'fetch が通ってしまう')
      assert.deepEqual(await ui.page.run(`return window.__csp`), [`connect-src ${BASE}`])
    },
  },
]

let server: ChildProcess | null = null

async function startServer() {
  // vite の preview で dist-e2e を配信する（npx を介さず、どの OS でも同じ起動のしかたにする）
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
  for (let i = 0; i < 100; i++) {
    if (await fetch(BASE).then((r) => r.ok, () => false)) return
    await sleep(100)
  }
  await stopServer()
  throw new Error('テスト用のサーバーが起動しませんでした')
}

async function stopServer() {
  if (!server) return
  const s = server
  server = null
  const exited = new Promise((r) => s.once('exit', r))
  s.kill()
  await exited
}

async function main() {
  const only = process.argv[2]
  await startServer()
  const browser = await Browser.launch(9349)
  let failed = 0
  try {
    for (const s of scenarios.filter((s) => !only || s.name.includes(only))) {
      const viewport = s.viewport ?? DESKTOP
      const page = await browser.newPage(viewport)
      // ページの中で起きた CSP 違反とエラーを記録しておく（意図して起こすもの以外は起きないはず）
      await page.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.__csp = []; window.__errors = [];
          document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
          addEventListener('error', e => window.__errors.push(String(e.message)));
          ${s.setup ?? ''}`,
      })
      const ui = new Ui(page, viewport.touch ? 'touch' : 'mouse')
      const t0 = Date.now()
      try {
        await s.run(ui)
        if (!s.name.startsWith('公開版の CSP')) assert.deepEqual(await page.run(`return window.__csp`), [], 'CSP 違反が起きた')
        assert.deepEqual(await page.run(`return window.__errors`), [], 'ページでエラーが起きた')
        console.log(`  ✓ ${s.name}（${((Date.now() - t0) / 1000).toFixed(1)}秒）`)
      } catch (e) {
        failed++
        console.log(`  ✗ ${s.name}\n      ${e instanceof Error ? e.message : String(e)}`)
        mkdirSync(FAILURES, { recursive: true })
        const { data } = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => ({ data: '' }))
        if (data) writeFileSync(join(FAILURES, `${scenarios.indexOf(s) + 1}.png`), Buffer.from(data, 'base64'))
      } finally {
        await page.send('Page.close').catch(() => {})
      }
    }
  } finally {
    await browser.close()
    await stopServer()
  }
  if (failed > 0) {
    console.log(`\n${failed} 件失敗しました（失敗時の画面: ${FAILURES}/）`)
    process.exit(1)
  }
  console.log('\ne2e OK')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
