/**
 * 本文を1字ずつの単位に分ける。kumi の units.ts から、パズルに要る分（全角の1字と約物の空きの詰め）だけを持ってきた。
 * ルビ・縦中横・欧文は問題に使わないので持たない（使えば check:puzzles で弾く）。
 */
import { charClass, punctuationAki, type CharClass } from './classes.ts'

export interface Unit {
  ch: string
  cls: CharClass
  /** 約物の枠のうち、字面の前・後ろにある空き（全角 = 1） */
  akiBefore: number
  akiAfter: number
  /** 約物が続く詰め（JLREQ 3.1.4）のあとに残す空き */
  before: number
  after: number
}

export function buildUnits(text: string): Unit[] {
  const units = [...text].map((ch): Unit => {
    const cls = charClass(ch)
    const aki = punctuationAki(cls)
    return { ch, cls, akiBefore: aki.before, akiAfter: aki.after, before: aki.before, after: aki.after }
  })
  for (let i = 1; i < units.length; i++) combine(units[i - 1], units[i])
  return units
}

/** 終わり括弧＋始め括弧は二分、終わり括弧どうし・始め括弧どうしはベタ */
function combine(a: Unit, b: Unit) {
  if (a.after > 0 && b.before > 0) b.before = 0
  if (a.after > 0 && (b.cls === 'close' || b.cls === 'period' || b.cls === 'comma')) a.after = 0
  if (a.cls === 'open' && b.before > 0) b.before = 0
}

/** 1字の字送り方向の長さ（約物は残した空きを含む） */
export const unitWidth = (u: Unit, before = u.before, after = u.after) => 1 - (u.akiBefore - before) - (u.akiAfter - after)

/** ――・…… は2字で1組なので、その間では改行しない */
export const inseparablePair = (a: Unit, b: Unit) => a.cls === 'inseparable' && b.cls === 'inseparable' && a.ch === b.ch

export const hangable = (u: Unit) => u.cls === 'period' || u.cls === 'comma'
