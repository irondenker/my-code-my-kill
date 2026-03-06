import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMediaUrl } from '../../../../utils/upload/media-url.util.js';

test('buildMediaUrl returns null for empty value', () => {
  assert.equal(buildMediaUrl(null, '/uploads'), null);
  assert.equal(buildMediaUrl('', '/uploads'), null);
});

test('buildMediaUrl keeps absolute path and prefixes filename with basePath', () => {
  assert.equal(buildMediaUrl('/uploads/posts/a.png', '/uploads/posts'), '/uploads/posts/a.png');
  assert.equal(buildMediaUrl('a.png', '/uploads/posts'), '/uploads/posts/a.png');
});
