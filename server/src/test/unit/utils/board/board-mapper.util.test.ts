import assert from 'node:assert/strict';
import test from 'node:test';
import { mapBoardMeta } from '../../../../utils/board/board-mapper.util.js';

test('mapBoardMeta maps DB row to board metadata shape', () => {
  const mapped = mapBoardMeta({
    board_id: 14,
    slug: 'notice',
    name: 'Notice',
    description: null,
    read_access: 'admin',
    create_access: 'admin',
  });

  assert.deepEqual(mapped, {
    boardId: 14,
    slug: 'notice',
    name: 'Notice',
    description: null,
    readAccess: 'admin',
    createAccess: 'admin',
  });
});
