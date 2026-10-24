import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createCharacter, updateCharacter } from '../src/office/engine/characters.js';
import { findOfficePath, isOfficeWalkable,LOUNGE_TARGETS, WORKSPACE_SEATS } from '../src/office/engine/office-world.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import { type ColorValue, type OfficeLayout, type SpriteData,TileType } from '../src/office/types.js';

const sprite: SpriteData = [['']];

function buildCatalog(): void {
  buildDynamicCatalog({
    catalog: [
      {
        id: 'WOODEN_CHAIR_FRONT',
        label: 'Wooden Chair Front',
        category: 'chairs',
        width: 16,
        height: 16,
        footprintW: 1,
        footprintH: 1,
        isDesk: false,
      },
      {
        id: 'SOFA_FRONT',
        label: 'Sofa Front',
        category: 'chairs',
        width: 32,
        height: 16,
        footprintW: 2,
        footprintH: 1,
        isDesk: false,
      },
    ],
    sprites: {
      WOODEN_CHAIR_FRONT: sprite,
      SOFA_FRONT: sprite,
    },
  });
}

function makeLayout(): OfficeLayout {
  const cols = 5;
  const rows = 5;
  const tiles: TileType[] = new Array(cols * rows).fill(TileType.FLOOR_1);
  const tileColors: Array<ColorValue | null> = new Array(cols * rows).fill(null);
  const furniture = [
    { uid: 'work-chair', type: 'WOODEN_CHAIR_FRONT', col: 1, row: 1 },
    { uid: 'lounge-front', type: 'SOFA_FRONT', col: 3, row: 3 },
  ];
  return { version: 1, cols, rows, tiles, tileColors, furniture, layoutRevision: 1 };
}

test('findOfficePath blocks occupied end tile', () => {
  const cols = 3;
  const rows = 1;
  const tiles: TileType[] = new Array(cols * rows).fill(TileType.FLOOR_1);
  const tileMap: TileType[][] = [tiles];
  const blocked = new Set<string>();

  const free = findOfficePath({ col: 0, row: 0 }, { col: 2, row: 0 }, tileMap, blocked);
  assert.equal(free.length, 2);

  const occupied = findOfficePath({ col: 0, row: 0 }, { col: 2, row: 0 }, tileMap, blocked, new Set(['1,0']));
  assert.equal(occupied.length, 0);
});

test('isOfficeWalkable respects occupancy', () => {
  const cols = 3;
  const rows = 1;
  const tiles: TileType[] = new Array(cols * rows).fill(TileType.FLOOR_1);
  const tileMap: TileType[][] = [tiles];
  const blocked = new Set<string>();

  assert.equal(isOfficeWalkable(1, 0, tileMap, blocked), true);
  assert.equal(isOfficeWalkable(1, 0, tileMap, blocked, new Set(['1,0'])), false);
});

test('waiting moves agent to lounge seat and reserves it', () => {
  buildCatalog();
  const os = new OfficeState(makeLayout());
  const workSeat = os.seats.get('work-chair');
  assert.ok(workSeat);
  assert.equal(workSeat!.kind, WORKSPACE_SEATS);

  os.addAgent(1, undefined, undefined, 'work-chair', true);
  const ch = os.characters.get(1)!;
  assert.equal(ch.seatId, 'work-chair');

  os.setAgentActive(1, false);
  os.setAgentActivity(1, LOUNGE_TARGETS);

  assert.equal(os.loungeReservations.size, 1);
  assert.notEqual(ch.loungeSeatId, null);
  assert.equal(ch.destinationSeatId, ch.loungeSeatId);
  assert.equal(ch.state, 'walk');

  const loungeSeat = os.seats.get(ch.loungeSeatId!);
  assert.ok(loungeSeat);
  assert.equal(loungeSeat!.kind, LOUNGE_TARGETS);
  assert.equal(loungeSeat!.assigned, true);
});

test('occupied lounge seats are not selected', () => {
  buildCatalog();
  const os = new OfficeState(makeLayout());

  const loungeSeats = Array.from(os.seats.values()).filter((s) => s.kind === LOUNGE_TARGETS);
  assert.equal(loungeSeats.length, 2);

  for (const seat of loungeSeats) {
    const occupant = createCharacter(100 + seat.seatCol, 0, null, null, 0);
    occupant.tileCol = seat.seatCol;
    occupant.tileRow = seat.seatRow;
    occupant.x = seat.seatCol * 16 + 8;
    occupant.y = seat.seatRow * 16 + 8;
    os.characters.set(occupant.id, occupant);
  }

  os.addAgent(1, undefined, undefined, 'work-chair', true);
  const ch = os.characters.get(1)!;

  os.setAgentActive(1, false);
  os.setAgentActivity(1, LOUNGE_TARGETS);

  assert.equal(ch.loungeSeatId, null);
  assert.equal(ch.destinationSeatId, null);
  assert.equal(os.loungeReservations.size, 0);
});

test('active returns agent to workspace seat', () => {
  buildCatalog();
  const os = new OfficeState(makeLayout());
  os.addAgent(1, undefined, undefined, 'work-chair', true);
  const ch = os.characters.get(1)!;

  os.setAgentActive(1, false);
  os.setAgentActivity(1, LOUNGE_TARGETS);
  assert.notEqual(ch.loungeSeatId, null);

  os.setAgentActive(1, true);
  os.setAgentActivity(1, WORKSPACE_SEATS);
  assert.equal(ch.loungeSeatId, null);
  assert.equal(os.loungeReservations.size, 0);
  assert.equal(ch.destinationSeatId, null);
  assert.equal(ch.state, 'type');
});

test('arrival at destination sets seated typing state', () => {
  buildCatalog();
  const os = new OfficeState(makeLayout());
  os.addAgent(1, undefined, undefined, 'work-chair', true);
  const ch = os.characters.get(1)!;

  os.setAgentActive(1, false);
  os.setAgentActivity(1, LOUNGE_TARGETS);
  assert.equal(ch.state, 'walk');

  for (let i = 0; i < 30; i++) {
    if (ch.path.length === 0 && ch.destinationSeatId === null) break;
    updateCharacter(ch, 100, os.walkableTiles, os.seats, os.tileMap, os.blockedTiles);
  }

  assert.equal(ch.path.length, 0);
  assert.equal(ch.destinationSeatId, null);
  assert.equal(ch.state, 'type');
});
