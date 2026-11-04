/**
 * 解いた記録（問題ごとの最良の★と乱れ）を、この端末のブラウザ（localStorage）に置く。どこへも送らない。
 * 読めない・書けない（プライベートウィンドウなど）ときは、保存なしで動く。
 */
export interface Record {
  stars: 1 | 2 | 3
  cost: number
}
export type Progress = { [id: string]: Record }

const KEY = 'oikomi:progress:v1'

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    const out: Progress = {}
    for (const [id, v] of Object.entries(data as { [k: string]: unknown })) {
      const r = v as Partial<Record>
      if ((r.stars === 1 || r.stars === 2 || r.stars === 3) && typeof r.cost === 'number' && Number.isFinite(r.cost)) out[id] = { stars: r.stars, cost: r.cost }
    }
    return out
  } catch {
    return {}
  }
}

/** 前の記録より良いときだけ書き換える。書き換えた記録を返す */
export function saveRecord(progress: Progress, id: string, rec: Record): Progress {
  const prev = progress[id]
  if (prev && prev.cost <= rec.cost) return progress
  const next = { ...progress, [id]: rec }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 保存できなくても遊べる
  }
  return next
}
