import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import 'dotenv/config';
import { sequelize } from '../../db/index.js';
import { createUserForRegister } from '../../services/auth.service.js';
import { createBoard } from '../../services/board.service.js';
import { createArticle } from '../../services/article.service.js';
import { hashPassword } from '../../utils/password.util.js';
import {
  cleanupBoard,
  cleanupUserById,
  cleanupUserByUsername,
  makeId,
  runDbTests,
  skipReason,
} from '../helpers/db-test.helpers.js';
import { loginAs, withTestServer } from '../helpers/http-test.helpers.js';

if (runDbTests) {
  before(async () => {
    await sequelize.authenticate();
  });

  after(async () => {
    await sequelize.close();
  });
}

test(
  'board list pagination normalizes invalid page and renders page slices',
  { skip: skipReason },
  async () => {
    const username = makeId('page-user').slice(0, 32);
    const password = 'page-user-pass-123';
    const boardSlug = makeId('page-board')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 24);

    let userId: number | null = null;
    let boardId: number | null = null;

    try {
      const user = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
      });
      userId = user.userId;

      const board = await createBoard({
        slug: boardSlug,
        name: 'Pagination Board',
        description: 'board-pagination-db-test',
        readAccess: 'public',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      for (let i = 1; i <= 12; i += 1) {
        await createArticle({
          boardId: board.boardId,
          userId: user.userId,
          title: `PAGINATION_POST_${i}`,
          content: `PAGINATION_CONTENT_${i}`,
        });
      }

      await withTestServer(async (baseUrl) => {
        const authCookie = await loginAs({
          baseUrl,
          username,
          password,
          nextPath: `/board/${boardSlug}`,
        });

        const invalidPage = await fetch(`${baseUrl}/board/${boardSlug}?page=abc`, {
          headers: { cookie: authCookie },
        });
        const invalidPageBody = await invalidPage.text();
        assert.equal(invalidPage.status, 200);
        assert.match(invalidPageBody, /href="\?(?=[^"]*page=2)[^"]*"/);
        assert.match(
          invalidPageBody,
          /<li class="page-item active">\s*<a class="page-link" href="\?(?=[^"]*page=1)[^"]*">1<\/a>/
        );

        const zeroPage = await fetch(`${baseUrl}/board/${boardSlug}?page=0`, {
          headers: { cookie: authCookie },
        });
        const zeroPageBody = await zeroPage.text();
        assert.equal(zeroPage.status, 200);
        assert.match(
          zeroPageBody,
          /<li class="page-item active">\s*<a class="page-link" href="\?(?=[^"]*page=1)[^"]*">1<\/a>/
        );

        const floatPage = await fetch(`${baseUrl}/board/${boardSlug}?page=1.9`, {
          headers: { cookie: authCookie },
        });
        const floatPageBody = await floatPage.text();
        assert.equal(floatPage.status, 200);
        assert.match(
          floatPageBody,
          /<li class="page-item active">\s*<a class="page-link" href="\?(?=[^"]*page=1)[^"]*">1<\/a>/
        );

        const secondPage = await fetch(`${baseUrl}/board/${boardSlug}?page=2`, {
          headers: { cookie: authCookie },
        });
        const secondPageBody = await secondPage.text();
        assert.equal(secondPage.status, 200);
        assert.match(
          secondPageBody,
          /<li class="page-item active">\s*<a class="page-link" href="\?(?=[^"]*page=2)[^"]*">2<\/a>/
        );

        const hugePage = await fetch(`${baseUrl}/board/${boardSlug}?page=999999`, {
          headers: { cookie: authCookie },
        });
        const hugePageBody = await hugePage.text();
        assert.equal(hugePage.status, 200);
        assert.match(hugePageBody, /Showing /);
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

test(
  'board list pagination supports limit selector and normalizes invalid limit',
  { skip: skipReason },
  async () => {
    const username = makeId('limit-user').slice(0, 32);
    const password = 'limit-user-pass-123';
    const boardSlug = makeId('limit-board')
      .replace(/[^a-z0-9-]/g, '')
      .toLowerCase()
      .slice(0, 24);

    let userId: number | null = null;
    let boardId: number | null = null;

    try {
      const user = await createUserForRegister({
        username,
        passwordHash: hashPassword(password),
      });
      userId = user.userId;

      const board = await createBoard({
        slug: boardSlug,
        name: 'Limit Board',
        description: 'board-limit-db-test',
        readAccess: 'public',
        createAccess: 'auth',
      });
      boardId = board.boardId;

      for (let i = 1; i <= 12; i += 1) {
        await createArticle({
          boardId: board.boardId,
          userId: user.userId,
          title: `LIMIT_POST_${i}`,
          content: `LIMIT_CONTENT_${i}`,
        });
      }

      await withTestServer(async (baseUrl) => {
        const authCookie = await loginAs({
          baseUrl,
          username,
          password,
          nextPath: `/board/${boardSlug}`,
        });

        const defaultLimit = await fetch(`${baseUrl}/board/${boardSlug}`, {
          headers: { cookie: authCookie },
        });
        const defaultLimitBody = await defaultLimit.text();
        assert.equal(defaultLimit.status, 200);
        assert.match(defaultLimitBody, /name="limit"/);
        assert.match(defaultLimitBody, /option value="10" selected/);
        assert.match(defaultLimitBody, /option value="20"/);
        assert.match(defaultLimitBody, /option value="30"/);
        assert.match(defaultLimitBody, /option value="40"/);
        assert.match(defaultLimitBody, /option value="50"/);
        assert.match(defaultLimitBody, /option value="100"/);
        assert.match(defaultLimitBody, /id="page-jump"/);
        assert.match(defaultLimitBody, /id="page-jump-meta"[^>]*>\s*\(Total\s+2\)\s*</);
        assert.match(defaultLimitBody, /Showing\s+1\s+to\s+10\s+of\s+12 Posts/);
        assert.match(defaultLimitBody, /href="\?(?=[^"]*page=2)[^"]*"/);

        const selectedLimit = await fetch(`${baseUrl}/board/${boardSlug}?limit=20`, {
          headers: { cookie: authCookie },
        });
        const selectedLimitBody = await selectedLimit.text();
        assert.equal(selectedLimit.status, 200);
        assert.match(selectedLimitBody, /option value="20" selected/);
        assert.match(selectedLimitBody, /aria-label="Pagination options"/);
        assert.match(selectedLimitBody, /id="page-jump-meta"[^>]*>\s*\(Total\s+1\)\s*</);
        assert.match(selectedLimitBody, /Showing\s+1\s+to\s+12\s+of\s+12 Posts/);
        assert.match(selectedLimitBody, /href="\?(?=[^"]*page=2)(?=[^"]*limit=20)[^"]*"/);

        const maxSelectedLimit = await fetch(`${baseUrl}/board/${boardSlug}?limit=100`, {
          headers: { cookie: authCookie },
        });
        const maxSelectedLimitBody = await maxSelectedLimit.text();
        assert.equal(maxSelectedLimit.status, 200);
        assert.match(maxSelectedLimitBody, /option value="100" selected/);
        assert.match(maxSelectedLimitBody, /href="\?(?=[^"]*page=2)(?=[^"]*limit=100)[^"]*"/);

        const invalidLimit = await fetch(`${baseUrl}/board/${boardSlug}?limit=abc`, {
          headers: { cookie: authCookie },
        });
        const invalidLimitBody = await invalidLimit.text();
        assert.equal(invalidLimit.status, 200);
        assert.match(invalidLimitBody, /option value="10" selected/);

        const oversizedLimit = await fetch(`${baseUrl}/board/${boardSlug}?limit=9999`, {
          headers: { cookie: authCookie },
        });
        const oversizedLimitBody = await oversizedLimit.text();
        assert.equal(oversizedLimit.status, 200);
        assert.match(oversizedLimitBody, /option value="100" selected/);
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
