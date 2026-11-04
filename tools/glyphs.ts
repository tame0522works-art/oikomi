/**
 * 問題に出てくる字だけの字形データ（src/glyphs.json）を作る。
 * フォント全体（BIZ UD明朝、6MB）を配らずに済み、端末のフォントに左右されずに字面の位置まで揃う。
 * 縦書き用の字形（GSUB の vert）に置き換え、字の枠の左上を原点・全角 = 1 の SVG の path にする。
 * フォントは kumi に同梱したものを使う（FONT で別の場所も指定できる）。字を足したら npm run glyphs を流し直す。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { glyphOutline, type PathOp } from './font/outline.ts'
import { parseFont } from './font/sfnt.ts'
import { PUZZLES } from '../src/puzzles/index.ts'

const fontPath = process.env.FONT ?? new URL('../../kumi/fonts/BIZUDMincho-Regular.ttf', import.meta.url)
const font = parseFont(new Uint8Array(readFileSync(fontPath)))
const upm = font.unitsPerEm

const chars = [...new Set(PUZZLES.flatMap((p) => [...p.text]))].sort()
const r = (v: number) => Math.round(v * 1000) / 1000

const glyphs: Record<string, string> = {}
for (const ch of chars) {
  const base = font.glyphId(ch.codePointAt(0)!)
  if (base === 0) throw new Error(`フォントにない字: ${ch}`)
  const gid = font.verticalGlyph(base)
  const box = font.bbox(gid)
  // 縦の原点は kumi の画面・PDF と同じく「外形の上端 + tsb」、横は送り幅の中央を枠の中央に
  const top = box ? box.yMax + font.topSideBearing(gid) : font.ascender
  const left = font.advanceWidth(gid) / 2
  const X = (x: number) => r((x - left) / upm + 0.5)
  const Y = (y: number) => r((top - y) / upm)
  glyphs[ch] = glyphOutline(font, gid)
    .map((op: PathOp) => {
      switch (op[0]) {
        case 'M':
        case 'L':
          return `${op[0]}${X(op[1])} ${Y(op[2])}`
        case 'Q':
          return `Q${X(op[1])} ${Y(op[2])} ${X(op[3])} ${Y(op[4])}`
        case 'Z':
          return 'Z'
      }
    })
    .join('')
}

writeFileSync(new URL('../src/glyphs.json', import.meta.url), JSON.stringify(glyphs) + '\n')
console.log(`${chars.length} 字、${(JSON.stringify(glyphs).length / 1024).toFixed(1)} KB`)
