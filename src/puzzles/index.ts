/**
 * 問題。本文はすべて書き下ろし。字詰め・行数・ぶら下げの回数は tools/scan.ts と tools/design.ts で調べて決める。
 * 解けること・最初の盤面に違反があることは check:puzzles で確かめる。
 */
import type { Puzzle } from '../engine/board.ts'

export const PUZZLES: Puzzle[] = [
  {
    id: 'yuki-hang',
    text: '――それで、結局どうなったの？……答えはなかった。窓の外では、ゆっくりと雪が降りはじめていた。',
    length: 10,
    rows: 5,
    hangs: 1,
  },
  {
    id: 'ane',
    text: '「ねえ、ちょっと待って」と姉は言った。「その箱、開ける前に写真を撮っておこう。あとで、何が入っていたか分からなくなるから」',
    length: 10,
    rows: 6,
    hangs: 0,
  },
  {
    id: 'yuki-11',
    text: '――それで、結局どうなったの？……答えはなかった。窓の外では、ゆっくりと雪が降りはじめていた。',
    length: 11,
    rows: 5,
    hangs: 0,
  },
]
