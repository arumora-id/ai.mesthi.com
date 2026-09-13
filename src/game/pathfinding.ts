export type Point = { x: number; y: number }
export function findPath(
  start: Point,
  end: Point,
  width: number,
  height: number,
  blocked: Set<string>,
): Point[] {
  const key = (p: Point) => p.x + ',' + p.y
  const valid = (p: Point) =>
    p.x >= 0 && p.y >= 0 && p.x < width && p.y < height && !blocked.has(key(p))
  if (!valid(start) || !valid(end)) return []
  const queue: Point[] = [start],
    parents = new Map<string, Point | null>([[key(start), null]])
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    if (key(p) === key(end)) {
      const path: Point[] = []
      let current: Point | null = p
      while (current) {
        path.unshift(current)
        current = parents.get(key(current)) ?? null
      }
      return path
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: p.x + dx, y: p.y + dy }
      if (valid(next) && !parents.has(key(next))) {
        parents.set(key(next), p)
        queue.push(next)
      }
    }
  }
  return []
}
