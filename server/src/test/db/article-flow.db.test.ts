import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import 'dotenv/config';
import sharp from 'sharp';
import {
  ARTICLE_ATTACHMENT_UPLOAD_DIR,
  ARTICLE_IMAGE_UPLOAD_DIR,
} from '../../constants/upload-article.constants.js';
import { sequelize } from '../../db/index.js';
import {
  createArticle,
  createArticleWithUploads,
  findNeighborArticles,
  deleteStoredArticleAttachment,
  deleteStoredArticleImage,
  countArticlesBySlug,
  doesArticleExistBySlugDisplayId,
  findArticleBySlugDisplayId,
  softDeleteArticleBySlugDisplayId,
  updateArticleWithUploads,
} from '../../services/article.service.js';
import { createUserForRegister } from '../../services/auth.service.js';
import { createBoard } from '../../services/board.service.js';
import { hashPassword } from '../../utils/password.util.js';
import {
  cleanupBoard,
  cleanupUserById,
  cleanupUserByUsername,
  makeId,
  runDbTests,
  skipReason,
} from '../helpers/db-test.helpers.js';
import { fetchFormPage, loginAs, withTestServer } from '../helpers/http-test.helpers.js';

function makeUpload(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'file.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    size: 0,
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.alloc(0),
    stream: null as any,
    ...overrides,
  };
}

async function makePngBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

const FIXED_UPLOAD_RANDOM_HEX = 'ab'.repeat(8);

async function withDeterministicUploadNames<T>(
  baseTimestamp: number,
  run: () => Promise<T>
): Promise<T> {
  const originalDateNow = Date.now;
  const cryptoRef = crypto as typeof crypto & { randomBytes: typeof crypto.randomBytes };
  const originalRandomBytes = cryptoRef.randomBytes;
  let tick = 0;

  Date.now = (() => baseTimestamp + tick++) as typeof Date.now;
  cryptoRef.randomBytes = ((size: number) =>
    Buffer.from(
      FIXED_UPLOAD_RANDOM_HEX.repeat(Math.ceil(size / 8)).slice(0, size * 2),
      'hex'
    )) as typeof crypto.randomBytes;

  try {
    return await run();
  } finally {
    Date.now = originalDateNow;
    cryptoRef.randomBytes = originalRandomBytes;
  }
}

if (runDbTests) {
  before(async () => {
    await sequelize.authenticate();
  });

  after(async () => {
    await sequelize.close();
  });
}

test(
  'article services create, read, count, and soft-delete by board slug/display id',
  { skip: skipReason },
  async () => {
    const username = makeId('writer').slice(0, 32);
    const boardSlug = makeId('article')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 30);
    let userId: number | null = null;
    let boardId: number | null = null;

    try {
      const user = await createUserForRegister({
        username,
        passwordHash: hashPassword('article-password'),
      });
      userId = user.userId;

      const board = await createBoard({
        slug: boardSlug,
        name: 'Article Board',
        description: 'article-service-test',
        readAccess: 'auth',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      const created = await createArticle({
        boardId: board.boardId,
        userId: user.userId,
        title: 'Service Article',
        content: 'Service article content',
      });
      assert.equal(created.displayId > 0, true);

      const countBeforeDelete = await countArticlesBySlug(boardSlug);
      assert.equal(countBeforeDelete, 1);

      const article = await findArticleBySlugDisplayId({
        slug: boardSlug,
        displayId: created.displayId,
      });
      assert.notEqual(article, null);
      assert.equal(article?.title, 'Service Article');
      assert.equal(article?.userId, user.userId);

      const existsBeforeDelete = await doesArticleExistBySlugDisplayId({
        slug: boardSlug,
        displayId: created.displayId,
      });
      assert.equal(existsBeforeDelete, true);

      const deleted = await softDeleteArticleBySlugDisplayId({
        slug: boardSlug,
        displayId: created.displayId,
        requestUserId: user.userId,
      });
      assert.equal(deleted, true);

      const existsAfterDelete = await doesArticleExistBySlugDisplayId({
        slug: boardSlug,
        displayId: created.displayId,
      });
      assert.equal(existsAfterDelete, false);

      const countAfterDelete = await countArticlesBySlug(boardSlug);
      assert.equal(countAfterDelete, 0);
    } finally {
      if (boardId !== null) {
        await cleanupBoard(boardId);
      }
      if (userId !== null) {
        await cleanupUserById(userId);
      } else {
        await cleanupUserByUsername(username);
      }
    }
  }
);

test(
  'createArticleWithUploads cleans stored files when DB create fails',
  { skip: skipReason },
  async () => {
    const username = makeId('upfail').slice(0, 32);
    const user = await createUserForRegister({
      username,
      passwordHash: hashPassword('upload-fail-pass-123'),
    });

    try {
      const baseTimestamp = Date.now();
      const expectedImagePath = path.join(
        ARTICLE_IMAGE_UPLOAD_DIR,
        `article-image-${baseTimestamp}-${FIXED_UPLOAD_RANDOM_HEX}.webp`
      );
      const expectedAttachmentPath = path.join(
        ARTICLE_ATTACHMENT_UPLOAD_DIR,
        `article-file-${baseTimestamp + 1}-${FIXED_UPLOAD_RANDOM_HEX}.txt`
      );
      const imageBuffer = await makePngBuffer();
      const attachmentBuffer = Buffer.from('cleanup-check', 'utf8');

      await deleteStoredArticleImage(path.basename(expectedImagePath));
      await deleteStoredArticleAttachment(path.basename(expectedAttachmentPath));

      await withDeterministicUploadNames(baseTimestamp, async () =>
        assert.rejects(async () =>
          createArticleWithUploads({
            boardId: -1,
            userId: user.userId,
            title: 'should-fail',
            content: 'should-fail',
            imageFile: makeUpload({
              originalname: 'before.png',
              mimetype: 'image/png',
              size: imageBuffer.length,
              buffer: imageBuffer,
            }),
            attachmentFile: makeUpload({
              originalname: 'before.txt',
              mimetype: 'text/plain',
              size: attachmentBuffer.length,
              buffer: attachmentBuffer,
            }),
          })
        )
      );

      await assert.rejects(async () => fs.access(expectedImagePath));
      await assert.rejects(async () => fs.access(expectedAttachmentPath));
    } finally {
      await cleanupUserById(user.userId);
    }
  }
);

test(
  'updateArticleWithUploads returns false and rolls back new uploads for missing post',
  { skip: skipReason },
  async () => {
    const baseTimestamp = Date.now() + 10_000;
    const expectedImagePath = path.join(
      ARTICLE_IMAGE_UPLOAD_DIR,
      `article-image-${baseTimestamp}-${FIXED_UPLOAD_RANDOM_HEX}.webp`
    );
    const expectedAttachmentPath = path.join(
      ARTICLE_ATTACHMENT_UPLOAD_DIR,
      `article-file-${baseTimestamp + 1}-${FIXED_UPLOAD_RANDOM_HEX}.txt`
    );
    const imageBuffer = await makePngBuffer();
    const attachmentBuffer = Buffer.from('update-missing-post', 'utf8');

    await deleteStoredArticleImage(path.basename(expectedImagePath));
    await deleteStoredArticleAttachment(path.basename(expectedAttachmentPath));

    const updated = await withDeterministicUploadNames(baseTimestamp, async () =>
      updateArticleWithUploads({
        postId: 987654321,
        title: 'missing-post',
        content: 'missing-post',
        imageFile: makeUpload({
          originalname: 'missing.png',
          mimetype: 'image/png',
          size: imageBuffer.length,
          buffer: imageBuffer,
        }),
        attachmentFile: makeUpload({
          originalname: 'missing.txt',
          mimetype: 'text/plain',
          size: attachmentBuffer.length,
          buffer: attachmentBuffer,
        }),
      })
    );

    assert.equal(updated, false);
    await assert.rejects(async () => fs.access(expectedImagePath));
    await assert.rejects(async () => fs.access(expectedAttachmentPath));
  }
);

test(
  'updateArticleWithUploads deletes replaced old files after successful update',
  { skip: skipReason },
  async () => {
    const username = makeId('upreplace').slice(0, 32);
    const boardSlug = makeId('upreplace-board')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 30);

    let userId: number | null = null;
    let boardId: number | null = null;
    let oldImageUrl: string | null = null;
    let oldFileUrl: string | null = null;
    let newImageUrl: string | null = null;
    let newFileUrl: string | null = null;

    try {
      const user = await createUserForRegister({
        username,
        passwordHash: hashPassword('upreplace-pass-123'),
      });
      userId = user.userId;

      const board = await createBoard({
        slug: boardSlug,
        name: 'Replace Upload Board',
        description: 'update-upload-dbtest',
        readAccess: 'auth',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      const imageBufferV1 = await makePngBuffer();
      const attachmentBufferV1 = Buffer.from('v1-attachment', 'utf8');
      const created = await createArticleWithUploads({
        boardId: board.boardId,
        userId: user.userId,
        title: 'Upload Replace V1',
        content: 'before',
        imageFile: makeUpload({
          originalname: 'v1.png',
          mimetype: 'image/png',
          size: imageBufferV1.length,
          buffer: imageBufferV1,
        }),
        attachmentFile: makeUpload({
          originalname: 'v1.txt',
          mimetype: 'text/plain',
          size: attachmentBufferV1.length,
          buffer: attachmentBufferV1,
        }),
      });

      const existing = await findArticleBySlugDisplayId({
        slug: boardSlug,
        displayId: created.displayId,
      });
      assert.notEqual(existing, null);
      oldImageUrl = existing?.imageUrl ?? null;
      oldFileUrl = existing?.fileUrl ?? null;
      assert.equal(typeof existing?.postId, 'number');

      if (oldImageUrl) {
        await fs.access(path.join(ARTICLE_IMAGE_UPLOAD_DIR, oldImageUrl));
      }
      if (oldFileUrl) {
        await fs.access(path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, oldFileUrl));
      }

      const imageBufferV2 = await makePngBuffer();
      const attachmentBufferV2 = Buffer.from('v2-attachment', 'utf8');
      const updated = await updateArticleWithUploads({
        postId: existing?.postId ?? 0,
        title: 'Upload Replace V2',
        content: 'after',
        currentImageUrl: oldImageUrl,
        currentFileUrl: oldFileUrl,
        imageFile: makeUpload({
          originalname: 'v2.png',
          mimetype: 'image/png',
          size: imageBufferV2.length,
          buffer: imageBufferV2,
        }),
        attachmentFile: makeUpload({
          originalname: 'v2.txt',
          mimetype: 'text/plain',
          size: attachmentBufferV2.length,
          buffer: attachmentBufferV2,
        }),
      });
      assert.equal(updated, true);

      const afterUpdate = await findArticleBySlugDisplayId({
        slug: boardSlug,
        displayId: created.displayId,
      });
      assert.notEqual(afterUpdate, null);
      newImageUrl = afterUpdate?.imageUrl ?? null;
      newFileUrl = afterUpdate?.fileUrl ?? null;

      assert.notEqual(newImageUrl, oldImageUrl);
      assert.notEqual(newFileUrl, oldFileUrl);

      if (newImageUrl) {
        await fs.access(path.join(ARTICLE_IMAGE_UPLOAD_DIR, newImageUrl));
      }
      if (newFileUrl) {
        await fs.access(path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, newFileUrl));
      }
      if (oldImageUrl) {
        const oldImageName = oldImageUrl;
        await assert.rejects(async () =>
          fs.access(path.join(ARTICLE_IMAGE_UPLOAD_DIR, oldImageName))
        );
      }
      if (oldFileUrl) {
        const oldFileName = oldFileUrl;
        await assert.rejects(async () =>
          fs.access(path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, oldFileName))
        );
      }
    } finally {
      await deleteStoredArticleImage(newImageUrl);
      await deleteStoredArticleAttachment(newFileUrl);
      await deleteStoredArticleImage(oldImageUrl);
      await deleteStoredArticleAttachment(oldFileUrl);

      if (boardId !== null) {
        await cleanupBoard(boardId);
      }
      if (userId !== null) {
        await cleanupUserById(userId);
      } else {
        await cleanupUserByUsername(username);
      }
    }
  }
);

test(
  'createArticle allocates unique sequential display ids under concurrent writes',
  { skip: skipReason },
  async () => {
    const username = makeId('conwriter').slice(0, 32);
    const boardSlug = makeId('conboard')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 24);
    let userId: number | null = null;
    let boardId: number | null = null;

    try {
      const user = await createUserForRegister({
        username,
        passwordHash: hashPassword('concurrent-pass-123'),
      });
      userId = user.userId;

      const board = await createBoard({
        slug: boardSlug,
        name: 'Concurrent Board',
        description: 'concurrency-dbtest',
        readAccess: 'auth',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      const batchSize = 20;
      const created = await Promise.all(
        Array.from({ length: batchSize }, (_, index) =>
          createArticle({
            boardId: board.boardId,
            userId: user.userId,
            title: `Concurrent Title ${index + 1}`,
            content: `Concurrent Content ${index + 1}`,
          })
        )
      );

      const displayIds = created.map((item) => item.displayId).sort((a, b) => a - b);
      assert.equal(new Set(displayIds).size, batchSize);
      assert.deepEqual(
        displayIds,
        Array.from({ length: batchSize }, (_, i) => i + 1)
      );

      const totalCount = await countArticlesBySlug(boardSlug);
      assert.equal(totalCount, batchSize);
    } finally {
      if (boardId !== null) {
        await cleanupBoard(boardId);
      }
      if (userId !== null) {
        await cleanupUserById(userId);
      } else {
        await cleanupUserByUsername(username);
      }
    }
  }
);

test(
  'findNeighborArticles handles first/last edges and owner filter',
  { skip: skipReason },
  async () => {
    const ownerUsername = makeId('neighbor-owner').slice(0, 32);
    const otherUsername = makeId('neighbor-other').slice(0, 32);
    const boardSlug = makeId('neighbor-board')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 24);
    let ownerUserId: number | null = null;
    let otherUserId: number | null = null;
    let boardId: number | null = null;

    try {
      const owner = await createUserForRegister({
        username: ownerUsername,
        passwordHash: hashPassword('neighbor-owner-pass-123'),
      });
      ownerUserId = owner.userId;

      const other = await createUserForRegister({
        username: otherUsername,
        passwordHash: hashPassword('neighbor-other-pass-123'),
      });
      otherUserId = other.userId;

      const board = await createBoard({
        slug: boardSlug,
        name: 'Neighbor Board',
        description: 'neighbor-dbtest',
        readAccess: 'auth',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      const first = await createArticle({
        boardId: board.boardId,
        userId: owner.userId,
        title: 'First by owner',
        content: 'first',
      });
      const second = await createArticle({
        boardId: board.boardId,
        userId: other.userId,
        title: 'Second by other',
        content: 'second',
      });
      const third = await createArticle({
        boardId: board.boardId,
        userId: owner.userId,
        title: 'Third by owner',
        content: 'third',
      });

      const middleAll = await findNeighborArticles({
        boardId: board.boardId,
        displayId: second.displayId,
      });
      assert.equal(middleAll.prevPost?.display_id, first.displayId);
      assert.equal(middleAll.nextPost?.display_id, third.displayId);

      const firstForOwnerOnly = await findNeighborArticles({
        boardId: board.boardId,
        displayId: first.displayId,
        viewerUserId: owner.userId,
      });
      assert.equal(firstForOwnerOnly.prevPost, null);
      assert.equal(firstForOwnerOnly.nextPost?.display_id, third.displayId);

      const thirdForOwnerOnly = await findNeighborArticles({
        boardId: board.boardId,
        displayId: third.displayId,
        viewerUserId: owner.userId,
      });
      assert.equal(thirdForOwnerOnly.prevPost?.display_id, first.displayId);
      assert.equal(thirdForOwnerOnly.nextPost, null);
    } finally {
      if (boardId !== null) {
        await cleanupBoard(boardId);
      }
      if (otherUserId !== null) {
        await cleanupUserById(otherUserId);
      } else {
        await cleanupUserByUsername(otherUsername);
      }
      if (ownerUserId !== null) {
        await cleanupUserById(ownerUserId);
      } else {
        await cleanupUserByUsername(ownerUsername);
      }
    }
  }
);

test(
  'authenticated user can create and read an article via HTTP flow',
  { skip: skipReason },
  async () => {
    const username = makeId('webwriter').slice(0, 32);
    const password = 'writer-pass-123';
    const boardSlug = makeId('webboard')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 24);

    let boardId: number | null = null;
    let userId: number | null = null;

    try {
      const board = await createBoard({
        slug: boardSlug,
        name: 'Web Board',
        description: 'http-flow-dbtest',
        readAccess: 'auth',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      const created = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
      });
      userId = created.userId;

      await withTestServer(async (baseUrl) => {
        const authCookie = await loginAs({
          baseUrl,
          username,
          password,
          nextPath: `/board/${boardSlug}`,
        });

        const newPage = await fetchFormPage({
          baseUrl,
          path: `/board/${encodeURIComponent(boardSlug)}/new`,
          cookie: authCookie,
        });
        const createResponse = await fetch(`${baseUrl}/board/${encodeURIComponent(boardSlug)}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            cookie: newPage.cookie,
          },
          body: `_csrf=${encodeURIComponent(newPage.csrfToken)}&title=${encodeURIComponent('HTTP DB Title')}&content=${encodeURIComponent('HTTP DB Content')}`,
          redirect: 'manual',
        });

        assert.equal(createResponse.status, 302);
        const location = createResponse.headers.get('location');
        assert.equal(typeof location === 'string', true);
        assert.match(location ?? '', new RegExp(`^/board/${boardSlug}/\\d+$`));

        const showResponse = await fetch(`${baseUrl}${location}`, {
          headers: {
            cookie: newPage.cookie,
          },
        });
        const showBody = await showResponse.text();
        assert.equal(showResponse.status, 200);
        assert.match(showBody, /HTTP DB Title/);
        assert.match(showBody, /HTTP DB Content/);
      });
    } finally {
      if (boardId !== null) {
        await cleanupBoard(boardId);
      }
      if (userId !== null) {
        await cleanupUserById(userId);
      } else {
        await cleanupUserByUsername(username);
      }
    }
  }
);
