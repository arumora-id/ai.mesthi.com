import { expect, it } from 'vitest'
import { findPath } from '../src/game/pathfinding'
it('routes around furniture using adjacent cells only', () => {
  const blocked = new Set(['2,0', '2,1', '2,2'])
  const path = findPath({ x: 0, y: 1 }, { x: 4, y: 1 }, 5, 5, blocked)
  expect(path[0]).toEqual({ x: 0, y: 1 })
  expect(path.at(-1)).toEqual({ x: 4, y: 1 })
  path.forEach((p, i) => {
    expect(blocked.has(p.x + ',' + p.y)).toBe(false)
    if (i) expect(Math.abs(p.x - path[i - 1].x) + Math.abs(p.y - path[i - 1].y)).toBe(1)
  })
})
it('does not teleport through a sealed wall or blocked destination', () => {
  expect(findPath({ x: 0, y: 1 }, { x: 2, y: 1 }, 3, 3, new Set(['1,0', '1,1', '1,2']))).toEqual([])
  expect(findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, 3, 3, new Set(['2,2']))).toEqual([])
})
