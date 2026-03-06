import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNeighborArticleQueryParams,
  ensureArticleReadAccessForViewer,
  ensureBoardCreateAccess,
  ensureBoardReadAccess,
  ensurePostEditAccess,
  getUploadedFile,
  readArticleFormInput,
  renderArticleCreateForm,
  renderArticleEditForm,
  resolveArticleDeletePlan,
  resolveArticleShowMutationFlags,
  requireAuthenticatedViewerId,
} from '../../../controllers/article/article.controller.helpers.js';
import { HttpError } from '../../../utils/http/http-error.js';

function makeReq(params?: {
  session?: { userId?: unknown; userRole?: unknown };
  files?: unknown;
  body?: unknown;
}) {
  return {
    session: {
      ...(params?.session ?? {}),
    },
    files: params?.files,
    body: params?.body,
  } as any;
}

function makeFile(fieldname: string, originalname: string) {
  return {
    fieldname,
    originalname,
  } as any;
}

function makeRes() {
  const statusCalls: number[] = [];
  const renderCalls: Array<{ view: string; model: Record<string, unknown> }> = [];

  const res = {
    status(code: number) {
      statusCalls.push(code);
      return res;
    },
    render(view: string, model: Record<string, unknown>) {
      renderCalls.push({ view, model });
      return res;
    },
  };

  return { res, statusCalls, renderCalls };
}

test('getUploadedFile resolves file from array/object shape and returns null when missing', () => {
  const missing = getUploadedFile(makeReq({ files: undefined }), 'image');
  assert.equal(missing, null);

  const fromArray = getUploadedFile(
    makeReq({
      files: [makeFile('attachment', 'a.txt'), makeFile('image', 'img.webp')],
    }),
    'image'
  );
  assert.equal(fromArray?.originalname, 'img.webp');

  const fromObject = getUploadedFile(
    makeReq({
      files: {
        image: [makeFile('image', 'first.png'), makeFile('image', 'second.png')],
      },
    }),
    'image'
  );
  assert.equal(fromObject?.originalname, 'first.png');
});

test('ensureBoardCreateAccess enforces 401/403 and returns viewer context on success', () => {
  const unauthReq = makeReq({ session: {} });
  assert.throws(
    () => ensureBoardCreateAccess(unauthReq, { createAccess: 'auth' }),
    (error: unknown) => error instanceof HttpError && error.status === 401
  );

  const userReq = makeReq({
    session: { userId: 7, userRole: 'user' },
  });
  assert.throws(
    () => ensureBoardCreateAccess(userReq, { createAccess: 'admin' }),
    (error: unknown) => error instanceof HttpError && error.status === 403
  );

  const adminReq = makeReq({
    session: { userId: 1, userRole: 'admin' },
  });
  const context = ensureBoardCreateAccess(adminReq, { createAccess: 'admin' });
  assert.deepEqual(context, {
    viewerUserId: 1,
    isAuthenticated: true,
    isAdmin: true,
  });
});

test('ensureBoardReadAccess enforces 401/403 and returns viewer context when readable', () => {
  const unauthReq = makeReq({ session: {} });
  assert.throws(
    () => ensureBoardReadAccess(unauthReq, { readAccess: 'auth' }),
    (error: unknown) => error instanceof HttpError && error.status === 401
  );

  const userReq = makeReq({
    session: { userId: 2, userRole: 'user' },
  });
  assert.throws(
    () => ensureBoardReadAccess(userReq, { readAccess: 'admin' }),
    (error: unknown) => error instanceof HttpError && error.status === 403
  );

  const readableContext = ensureBoardReadAccess(unauthReq, { readAccess: 'public' });
  assert.deepEqual(readableContext, {
    viewerUserId: NaN,
    isAuthenticated: false,
    isAdmin: false,
  });
});

test('ensurePostEditAccess follows board mutation policy for owner and admin', () => {
  const ownerReq = makeReq({
    session: { userId: 10, userRole: 'user' },
  });
  const ownerContext = ensurePostEditAccess(ownerReq, {
    boardSlug: 'free',
    userId: 10,
  });
  assert.equal(ownerContext.isAuthenticated, true);

  const strangerReq = makeReq({
    session: { userId: 11, userRole: 'user' },
  });
  assert.throws(
    () => ensurePostEditAccess(strangerReq, { boardSlug: 'free', userId: 10 }),
    (error: unknown) => error instanceof HttpError && error.status === 403
  );

  const adminReq = makeReq({
    session: { userId: 77, userRole: 'admin' },
  });
  const adminContext = ensurePostEditAccess(adminReq, {
    boardSlug: 'announcement',
    userId: 10,
  });
  assert.equal(adminContext.isAdmin, true);
});

test('requireAuthenticatedViewerId returns id for valid context and throws for invalid context', () => {
  assert.equal(
    requireAuthenticatedViewerId({
      viewerUserId: 5,
      isAuthenticated: true,
      isAdmin: false,
    }),
    5
  );

  assert.throws(
    () =>
      requireAuthenticatedViewerId({
        viewerUserId: 0,
        isAuthenticated: false,
        isAdmin: false,
      }),
    (error: unknown) => error instanceof HttpError && error.status === 401
  );
});

test('resolveArticleDeletePlan enforces auth/admin policy and returns expected mode', () => {
  const ownerReq = makeReq({
    session: { userId: 10, userRole: 'user' },
  });
  const ownerPlan = resolveArticleDeletePlan(ownerReq, 'free');
  assert.deepEqual(ownerPlan, {
    mode: 'selfOrAdmin',
    requestUserId: 10,
  });

  const strangerReq = makeReq({
    session: { userId: 11, userRole: 'user' },
  });
  assert.throws(
    () => resolveArticleDeletePlan(strangerReq, 'announcement'),
    (error: unknown) => error instanceof HttpError && error.status === 403
  );

  const adminReq = makeReq({
    session: { userId: 1, userRole: 'admin' },
  });
  const adminPlan = resolveArticleDeletePlan(adminReq, 'announcement');
  assert.deepEqual(adminPlan, {
    mode: 'admin',
    requestUserId: 1,
  });
});

test('ensureArticleReadAccessForViewer allows readable cases and throws 403 otherwise', () => {
  ensureArticleReadAccessForViewer({
    boardReadAccess: 'public',
    viewerContext: {
      viewerUserId: NaN,
      isAuthenticated: false,
      isAdmin: false,
    },
    postUserId: 1,
  });

  assert.throws(
    () =>
      ensureArticleReadAccessForViewer({
        boardReadAccess: 'owner_or_admin',
        viewerContext: {
          viewerUserId: 7,
          isAuthenticated: true,
          isAdmin: false,
        },
        postUserId: 10,
      }),
    (error: unknown) => error instanceof HttpError && error.status === 403
  );
});

test('resolveArticleShowMutationFlags returns edit/delete flags by board policy', () => {
  const ownerFlags = resolveArticleShowMutationFlags({
    boardSlug: 'free',
    viewerContext: {
      viewerUserId: 10,
      isAuthenticated: true,
      isAdmin: false,
    },
    postUserId: 10,
  });
  assert.deepEqual(ownerFlags, { canEdit: true, canDelete: true });

  const strangerFlags = resolveArticleShowMutationFlags({
    boardSlug: 'free',
    viewerContext: {
      viewerUserId: 11,
      isAuthenticated: true,
      isAdmin: false,
    },
    postUserId: 10,
  });
  assert.deepEqual(strangerFlags, { canEdit: false, canDelete: false });

  const adminFlags = resolveArticleShowMutationFlags({
    boardSlug: 'announcement',
    viewerContext: {
      viewerUserId: 1,
      isAuthenticated: true,
      isAdmin: true,
    },
    postUserId: 10,
  });
  assert.deepEqual(adminFlags, { canEdit: true, canDelete: true });
});

test('buildNeighborArticleQueryParams includes viewer id only for owner_or_admin non-admin viewers', () => {
  const publicParams = buildNeighborArticleQueryParams({
    boardId: 5,
    displayId: 8,
    boardReadAccess: 'public',
    viewerContext: {
      viewerUserId: NaN,
      isAuthenticated: false,
      isAdmin: false,
    },
  });
  assert.deepEqual(publicParams, { boardId: 5, displayId: 8 });

  const ownerOnlyParams = buildNeighborArticleQueryParams({
    boardId: 5,
    displayId: 8,
    boardReadAccess: 'owner_or_admin',
    viewerContext: {
      viewerUserId: 42,
      isAuthenticated: true,
      isAdmin: false,
    },
  });
  assert.deepEqual(ownerOnlyParams, {
    boardId: 5,
    displayId: 8,
    viewerUserId: 42,
  });

  const adminParams = buildNeighborArticleQueryParams({
    boardId: 5,
    displayId: 8,
    boardReadAccess: 'owner_or_admin',
    viewerContext: {
      viewerUserId: 1,
      isAuthenticated: true,
      isAdmin: true,
    },
  });
  assert.deepEqual(adminParams, { boardId: 5, displayId: 8 });
});

test('readArticleFormInput parses object body and falls back for non-object body', () => {
  const parsed = readArticleFormInput(
    makeReq({
      body: {
        title: '  hello  ',
        content: '  world  ',
      },
    })
  );
  assert.deepEqual(parsed, {
    title: 'hello',
    content: 'world',
  });

  const fallback = readArticleFormInput(
    makeReq({
      body: 'not-an-object',
    })
  );
  assert.deepEqual(fallback, {
    title: '',
    content: '',
  });
});

test('renderArticleCreateForm and renderArticleEditForm build expected views and models', () => {
  const createRes = makeRes();
  renderArticleCreateForm({
    res: createRes.res as any,
    board: { slug: 'free', name: 'Free Board' },
    formError: 'invalid input',
    title: 'T',
    content: 'C',
    status: 422,
  });

  assert.deepEqual(createRes.statusCalls, [422]);
  assert.equal(createRes.renderCalls.length, 1);
  assert.equal(createRes.renderCalls[0]?.view, 'board/new');
  assert.equal(createRes.renderCalls[0]?.model.boardSlug, 'free');
  assert.equal(createRes.renderCalls[0]?.model.boardDisplayName, 'Free Board');
  assert.equal(createRes.renderCalls[0]?.model.formError, 'invalid input');
  assert.equal(createRes.renderCalls[0]?.model.title, 'T');
  assert.equal(createRes.renderCalls[0]?.model.content, 'C');

  const editRes = makeRes();
  renderArticleEditForm({
    res: editRes.res as any,
    post: {
      boardSlug: 'free',
      boardName: 'Free Board',
      displayId: 9,
      imageUrl: 'folder/preview.webp',
      fileUrl: '/uploads/posts/files/manual.txt',
    },
    title: 'Edited title',
    content: 'Edited content',
    formError: null,
  });

  assert.deepEqual(editRes.statusCalls, []);
  assert.equal(editRes.renderCalls.length, 1);
  assert.equal(editRes.renderCalls[0]?.view, 'board/edit');
  assert.equal(editRes.renderCalls[0]?.model.boardSlug, 'free');
  assert.equal(editRes.renderCalls[0]?.model.displayId, 9);
  assert.equal(editRes.renderCalls[0]?.model.imageUrl, '/uploads/posts/images/folder/preview.webp');
  assert.equal(editRes.renderCalls[0]?.model.imageName, 'preview.webp');
  assert.equal(editRes.renderCalls[0]?.model.fileUrl, '/uploads/posts/files/manual.txt');
  assert.equal(editRes.renderCalls[0]?.model.fileName, 'manual.txt');
});
