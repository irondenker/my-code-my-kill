import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, test } from 'node:test';
import sharp from 'sharp';
import {
  ARTICLE_ATTACHMENT_UPLOAD_DIR,
  ARTICLE_IMAGE_UPLOAD_DIR,
} from '../../../constants/upload-article.constants.js';
import {
  deleteStoredArticleAttachment,
  deleteStoredArticleImage,
  storeArticleAttachment,
  storeArticleImage,
} from '../../../services/article/article-upload.service.js';
import { getLabOptions } from '../../../config/lab-options.js';

const createdImageFiles = new Set<string>();
const createdAttachmentFiles = new Set<string>();

after(async () => {
  await Promise.all(
    Array.from(createdImageFiles, (filename) => deleteStoredArticleImage(filename))
  );
  await Promise.all(
    Array.from(createdAttachmentFiles, (filename) => deleteStoredArticleAttachment(filename))
  );
});

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

test('storeArticleImage enforces mimetype rule only when mimeCheck is enabled', async () => {
  const { mimeCheck } = getLabOptions().uploadValidation;
  const pngBuffer = await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  })
    .png()
    .toBuffer();

  const file = makeUpload({
    originalname: 'avatar.png',
    mimetype: 'text/plain',
    buffer: pngBuffer,
    size: pngBuffer.length,
  });

  if (mimeCheck) {
    await assert.rejects(async () => storeArticleImage(file), /Unsupported image type\./);
    return;
  }

  const filename = await storeArticleImage(file);
  createdImageFiles.add(filename);
  assert.match(filename, /^article-image-.*\.webp$/);

  await deleteStoredArticleImage(filename);
  createdImageFiles.delete(filename);
});

test('storeArticleImage stores webp output and deleteStoredArticleImage removes it', async () => {
  const pngBuffer = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
    },
  })
    .png()
    .toBuffer();

  const filename = await storeArticleImage(
    makeUpload({
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: pngBuffer.length,
      buffer: pngBuffer,
    })
  );
  createdImageFiles.add(filename);

  assert.match(filename, /^article-image-.*\.webp$/);
  const outputPath = path.join(ARTICLE_IMAGE_UPLOAD_DIR, filename);
  await fs.access(outputPath);

  await deleteStoredArticleImage(filename);
  createdImageFiles.delete(filename);
  await assert.rejects(async () => fs.access(outputPath));
});

test('storeArticleAttachment rejects unsupported extension when extension check is enabled', async () => {
  const { extensionCheck, mimeCheck, magicNumberCheck } = getLabOptions().uploadValidation;
  const shouldReject = extensionCheck || (magicNumberCheck && !mimeCheck);
  const content = Buffer.from('plain text');
  const file = makeUpload({
    originalname: 'bad.exe',
    mimetype: 'text/plain',
    buffer: content,
    size: content.length,
  });

  if (shouldReject) {
    await assert.rejects(
      async () => storeArticleAttachment(file),
      /Unsupported attachment (extension|type)\./
    );
    return;
  }

  const filename = await storeArticleAttachment(file);
  createdAttachmentFiles.add(filename);
  await deleteStoredArticleAttachment(filename);
  createdAttachmentFiles.delete(filename);
});

test('storeArticleAttachment rejects invalid pdf signature', async () => {
  const { magicNumberCheck } = getLabOptions().uploadValidation;
  const bogusPdf = Buffer.from('not-a-real-pdf');
  const file = makeUpload({
    originalname: 'doc.pdf',
    mimetype: 'application/pdf',
    buffer: bogusPdf,
    size: bogusPdf.length,
  });

  if (magicNumberCheck) {
    await assert.rejects(async () => storeArticleAttachment(file), /Unsupported attachment type\./);
    return;
  }

  const filename = await storeArticleAttachment(file);
  createdAttachmentFiles.add(filename);
  await deleteStoredArticleAttachment(filename);
  createdAttachmentFiles.delete(filename);
});

test('storeArticleAttachment stores and deletes utf-8 text attachment', async () => {
  const text = Buffer.from('hello,attachment\nline2', 'utf8');
  const filename = await storeArticleAttachment(
    makeUpload({
      originalname: 'memo.txt',
      mimetype: 'text/plain',
      buffer: text,
      size: text.length,
    })
  );
  createdAttachmentFiles.add(filename);

  assert.match(filename, /^article-file-.*\.txt$/);
  const outputPath = path.join(ARTICLE_ATTACHMENT_UPLOAD_DIR, filename);
  await fs.access(outputPath);

  await deleteStoredArticleAttachment(filename);
  createdAttachmentFiles.delete(filename);
  await assert.rejects(async () => fs.access(outputPath));
});
