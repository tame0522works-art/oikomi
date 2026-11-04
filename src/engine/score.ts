/** ★の付け方。最善の解の乱れとの差で決める */

const EPS = 0.05

export function stars(cost: number, optimum: number): 1 | 2 | 3 {
  if (cost <= optimum + EPS) return 3
  if (cost <= optimum * 1.5 + 2) return 2
  return 1
}

/** 画面に出す乱れの点（小数を見せない） */
export const displayCost = (cost: number) => Math.round(cost * 10)
