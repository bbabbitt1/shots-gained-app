import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOwnedBy } from '../src/services/offline.ts';

test('pending rounds sync only for the player who queued them', () => {
  assert.equal(isOwnedBy({ playerId: 1 }, 1), true);
  assert.equal(isOwnedBy({ playerId: 1 }, 2), false);
  assert.equal(isOwnedBy({ playerId: 1 }, undefined), false);
  assert.equal(isOwnedBy({}, 2), false); // untagged rounds need an explicit claim
  assert.equal(isOwnedBy({}, undefined), false);
});
