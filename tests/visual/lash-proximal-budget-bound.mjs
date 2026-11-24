// A lower bound for the existing signed closest-segment gate. The distance
// to each finite segment is 1-Lipschitz. At a point r pixels away, a segment
// can win only if its original distance exceeds the nearest by at most 2r.
export function proximalBudgetBound(point, lid, lower, gate = 1.5) {
  const low = lower.reduce((a, p) => ({x: a.x + p.x / lower.length, y: a.y + p.y / lower.length}), {x: 0, y: 0});
  const segments = [];
  for (let i = 1; i < lid.length; i++) {
    const a = lid[i - 1], b = lid[i];
    const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 1e-8) continue;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    const px = a.x + t * dx, py = a.y + t * dy;
    const length = Math.sqrt(lengthSquared);
    const nx = -dy / length, ny = dx / length;
    const orientation = nx * (low.x - px) + ny * (low.y - py);
    const offset = (point.x - px) * nx + (point.y - py) * ny;
    // A collinear lower reference makes the sign numerically unstable.
    const signed = Math.abs(orientation) < 1e-9 ? -Math.abs(offset) : orientation > 0 ? -offset : offset;
    segments.push({distance: Math.hypot(point.x - px, point.y - py), signed});
  }
  if (!segments.length) return null;
  const nearest = Math.min(...segments.map(s => s.distance));
  return Math.min(...segments.map(s => Math.max(0, (s.distance - nearest) / 2, s.signed - gate)));
}

// The enclosing disk includes the entire polygon, including concave regions.
// Triangle inequality turns a center bound into a bound for every label point.
export function regionBudgetBound(region, lid, lower) {
  const center = {x: region.reduce((sum, p) => sum + p[0], 0) / region.length,
    y: region.reduce((sum, p) => sum + p[1], 0) / region.length};
  const enclosingRadius = Math.max(...region.map(([x, y]) => Math.hypot(x - center.x, y - center.y)));
  const centerBound = proximalBudgetBound(center, lid, lower);
  return {center, enclosingRadius, centerBound,
    lowerBound: centerBound === null ? null : Math.max(0, centerBound - enclosingRadius)};
}
