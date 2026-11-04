// README に載せる画面の画像を撮る。公開と同じ設定のビルドを配信した状態（npm run build → npm run preview）で
// `npm run screenshots` を実行する。Edge（なければ Chrome）を画面なしで起動し、Chrome DevTools Protocol で操作する。
// 操作は決まった手順なので、アプリを直したら同じ画像を撮り直せる。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Browser, sleep, type Page } from './cdp.ts'

const BASE = process.argv[2] ?? 'http://localhost:5210/'
const OUT = 'docs/images'

async function shoot(cdp: Page, name: string) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, name), Buffer.from(data, 'base64'))
  console.log(`  ${OUT}/${name}`)
}

async function open(cdp: Page) {
  await cdp.goto(BASE)
  // 同じポートで別の作品が動いていると、その画面を撮ってしまうので、oikomi であることを先に確かめる
  const title = await cdp.run<string>(`return document.title`)
  if (title !== 'oikomi') throw new Error(`${BASE} で動いているのは oikomi ではありません（ページの題名: ${title || 'なし'}）`)
  await cdp.waitFor(`document.querySelector('.levels button')`, '一覧の表示')
}

/** 見えている文字か aria-label でボタンを押す（画像に写らない操作なので click で足りる） */
const press = (cdp: Page, label: string) =>
  cdp.run(`[...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g, '').startsWith(${JSON.stringify(label)}) || b.getAttribute('aria-label') === ${JSON.stringify(label)}).click()`)
const line = (cdp: Page, j: number) =>
  cdp.run(`document.querySelector('rect.col[aria-label="${j + 1}行目を選ぶ"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)

async function main() {
  mkdirSync(OUT, { recursive: true })
  // このブラウザ専用の一時プロファイルを使うので、普段のデータには触れない
  const browser = await Browser.launch()
  try {
    const cdp = await browser.newPage({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    console.log('撮影:')

    // 1. 9問目を開いたところ。行頭の読点が2か所光り、最後の行がはみ出している
    await open(cdp)
    await press(cdp, '9問目')
    await sleep(300)
    await shoot(cdp, 'start.png')

    // 2. 1問目: 3行目に読点をぶら下げ、4行目に追い込んで ★3
    await open(cdp)
    await press(cdp, '1問目')
    await line(cdp, 2)
    await press(cdp, 'ぶら下げ')
    await press(cdp, '続けて揃える')
    await line(cdp, 3)
    await press(cdp, '追い込む')
    await sleep(400)
    await shoot(cdp, 'clear.png')

    // 3. 一覧（1問目だけ解いた記録がある）
    await press(cdp, '←一覧')
    await sleep(200)
    await shoot(cdp, 'menu.png')
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
