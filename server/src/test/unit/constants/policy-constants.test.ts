import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  BOARD_MAX_TITLE_LENGTH,
} from '../../../constants/board.constants.js';
import {
  ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES,
  ARTICLE_ATTACHMENT_EXTENSIONS,
  ARTICLE_ATTACHMENT_MAX_BYTES,
  ARTICLE_IMAGE_ALLOWED_MIME_TYPES,
  ARTICLE_IMAGE_MAX_BYTES,
} from '../../../constants/upload-article.constants.js';
import {
  AVATAR_IMAGE_ALLOWED_MIME_TYPES,
  AVATAR_IMAGE_MAX_BYTES,
  AVATAR_IMAGE_MAX_DIMENSION,
  AVATAR_IMAGE_MIN_DIMENSION,
  AVATAR_IMAGE_OUTPUT_SIZE,
} from '../../../constants/upload-avatar.constants.js';

test('board pagination/title constants keep expected baseline values', () => {
  assert.equal(Number.isInteger(PAGINATION_DEFAULT_LIMIT), true);
  assert.equal(Number.isInteger(PAGINATION_MAX_LIMIT), true);
  assert.equal(Number.isInteger(BOARD_MAX_TITLE_LENGTH), true);
  assert.equal(PAGINATION_DEFAULT_LIMIT > 0, true);
  assert.equal(PAGINATION_MAX_LIMIT >= PAGINATION_DEFAULT_LIMIT, true);
  assert.equal(BOARD_MAX_TITLE_LENGTH >= 50, true);
});

test('article upload constants keep allowed mime/extension policy', () => {
  assert.equal(ARTICLE_IMAGE_ALLOWED_MIME_TYPES.has('image/jpeg'), true);
  assert.equal(ARTICLE_IMAGE_ALLOWED_MIME_TYPES.has('image/png'), true);
  assert.equal(ARTICLE_IMAGE_ALLOWED_MIME_TYPES.has('image/webp'), true);

  assert.equal(ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES.has('application/pdf'), true);
  assert.equal(ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES.has('text/plain'), true);
  assert.equal(ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES.has('text/csv'), true);
  assert.equal(ARTICLE_ATTACHMENT_ALLOWED_MIME_TYPES.has('application/zip'), true);

  assert.equal(ARTICLE_ATTACHMENT_EXTENSIONS.has('.pdf'), true);
  assert.equal(ARTICLE_ATTACHMENT_EXTENSIONS.has('.txt'), true);
  assert.equal(ARTICLE_ATTACHMENT_EXTENSIONS.has('.csv'), true);
  assert.equal(ARTICLE_ATTACHMENT_EXTENSIONS.has('.zip'), true);

  assert.equal(ARTICLE_IMAGE_MAX_BYTES > 1024 * 1024, true);
  assert.equal(ARTICLE_ATTACHMENT_MAX_BYTES > 1024 * 1024, true);
  assert.equal(ARTICLE_IMAGE_MAX_BYTES >= ARTICLE_ATTACHMENT_MAX_BYTES, true);
});

test('avatar upload constants keep mime/size/dimension policy', () => {
  assert.equal(AVATAR_IMAGE_ALLOWED_MIME_TYPES.has('image/jpeg'), true);
  assert.equal(AVATAR_IMAGE_ALLOWED_MIME_TYPES.has('image/png'), true);
  assert.equal(AVATAR_IMAGE_ALLOWED_MIME_TYPES.has('image/webp'), true);

  assert.equal(AVATAR_IMAGE_MAX_BYTES > 512 * 1024, true);
  assert.equal(AVATAR_IMAGE_MIN_DIMENSION >= 64, true);
  assert.equal(AVATAR_IMAGE_MAX_DIMENSION > AVATAR_IMAGE_MIN_DIMENSION, true);
  assert.equal(AVATAR_IMAGE_OUTPUT_SIZE >= AVATAR_IMAGE_MIN_DIMENSION, true);
  assert.equal(AVATAR_IMAGE_OUTPUT_SIZE <= AVATAR_IMAGE_MAX_DIMENSION, true);
  assert.equal(AVATAR_IMAGE_MAX_DIMENSION > AVATAR_IMAGE_MIN_DIMENSION, true);
});
