import { findPath, isWalkable } from '../layout/tileMap.js';
import type { OfficeTarget, TileType as TileTypeVal } from '../types.js';

export const LOUNGE_TARGETS: OfficeTarget = 'lounge';
export const WORKSPACE_SEATS: OfficeTarget = 'workspace';

/** Pink-sofa lounge tiles (the idle rest area). Idle agents are forced onto
 *  one of these instead of the nearest lounge seat — a deterministic pick
 *  keyed by agent id so a whole team doesn't pile onto one cushion. */
export const PINK_SOFA_SEATS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 13, y: 14 },
  { x: 13, y: 15 },
  { x: 16, y: 14 },
  { x: 16, y: 15 },
  { x: 14, y: 16 },
];

export const EMPTY_OCCUPIED: ReadonlySet<string> = Object.freeze(new Set<string>());

export interface OfficePoint {
  col: number;
  row: number;
}

export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function isOfficeWalkable(
  col: number,
  row: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  occupied: ReadonlySet<string> = EMPTY_OCCUPIED,
): boolean {
  return isWalkable(col, row, tileMap, blockedTiles) && !occupied.has(tileKey(col, row));
}

export function findOfficePath(
  start: OfficePoint,
  end: OfficePoint,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  occupied: ReadonlySet<string> = EMPTY_OCCUPIED,
  unblockTiles: ReadonlySet<string> = EMPTY_OCCUPIED,
): OfficePoint[] {
  const activeBlocked = new Set(blockedTiles);
  for (const key of unblockTiles) {
    activeBlocked.delete(key);
  }
  return findPath(start.col, start.row, end.col, end.row, tileMap, activeBlocked, occupied);
}
