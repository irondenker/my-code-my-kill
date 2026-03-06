import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../db/index.js';
import { closeDb } from '../db/close.js';
import { hashPassword } from '../utils/password.util.js';
import { AVATAR_IMAGE_UPLOAD_DIR } from '../constants/upload-avatar.constants.js';
import {
  ARTICLE_ATTACHMENT_EXTENSIONS,
  ARTICLE_ATTACHMENT_UPLOAD_DIR,
  ARTICLE_IMAGE_UPLOAD_DIR,
} from '../constants/upload-article.constants.js';
import {
  uploadAttachmentFromPath,
  uploadPostImageFromPath,
  uploadProfileImageFromPath,
} from '../services/seed/seed-upload.service.js';

const TOTAL_USERS = 62;
const TOTAL_POSTS = 1124;
const DEFAULT_AUDIT_LOG_COUNT = 45_000;
const DEFAULT_SEED_TEXT = 'mcmk-realistic-seed-v2';
const AVATAR_ATTACH_RATE = 0.7;
const POST_RECENT_RATIO = 0.32;
const AUDIT_RECENT_RATIO = 0.3;

const BOARD_DISTRIBUTION = [
  { key: 'general', ratio: 0.52 },
  { key: 'user-only', ratio: 0.26 },
  { key: 'qna', ratio: 0.16 },
  { key: 'announcement', ratio: 0.06 },
] as const;

const POST_MEDIA_DISTRIBUTION = [
  { key: 'image_and_file', ratio: 0.12 },
  { key: 'image_only', ratio: 0.52 },
  { key: 'file_only', ratio: 0.08 },
  { key: 'none', ratio: 0.28 },
] as const;

const POST_LENGTH_DISTRIBUTION = [
  { key: 'short', ratio: 0.55 },
  { key: 'medium', ratio: 0.35 },
  { key: 'long', ratio: 0.1 },
] as const;

const POST_LANGUAGE_DISTRIBUTION = [
  { key: 'ko', ratio: 0.88 },
  { key: 'en', ratio: 0.12 },
] as const;

const AUDIT_ACTIVITY_DISTRIBUTION = [
  { key: 'post_view', ratio: 0.74 },
  { key: 'login_success', ratio: 0.12 },
  { key: 'login_fail', ratio: 0.04 },
  { key: 'post_update', ratio: 0.02 },
  { key: 'post_delete', ratio: 0.004 },
  { key: 'post_create', ratio: 0.012 },
  { key: 'logout', ratio: 0.03 },
  { key: 'authz_denied', ratio: 0.02 },
  { key: 'rate_limited', ratio: 0.006 },
  { key: 'password_reset_requested', ratio: 0.004 },
  { key: 'password_reset_completed', ratio: 0.002 },
  { key: 'account_locked', ratio: 0.002 },
] as const;

const ADMIN_USERNAMES = ['admin', 'adminops'] as const;
const PENTEST_USERNAMES = ['pentest', 'pentestlab'] as const;

const GENERAL_USERNAMES = [
  'adrian',
  'alice',
  'allen',
  'amber',
  'bruno',
  'carson',
  'diana',
  'elena',
  'felix',
  'grace',
  'hansel',
  'irene',
  'jared',
  'karen',
  'kevin',
  'louis',
  'mason',
  'nolan',
  'oliver',
  'peter',
  'quinn',
  'rachel',
  'samuel',
  'taylor',
  'ursula',
  'victor',
  'warren',
  'xavier',
  'yvette',
  'zack',
  'minseo',
  'jiho',
  'seojin',
  'haeun',
  'taehyun',
  'jisoo',
  'sujin',
  'hyerin',
  'junseo',
  'yujin',
  'seungmin',
  'haemin',
  'donghyun',
  'chaewon',
  'yeji',
  'sangwoo',
  'hyunjin',
  'gyuri',
  'jinwoo',
  'hyejin',
  'eunji',
  'siwoo',
  'doyun',
  'arin',
  'nayoung',
  'woojin',
  'seungah',
  'dayoon',
] as const;

const ENGLISH_FOCUS_USERS = new Set<string>(['oliver', 'quinn', 'samuel']);

const KOREAN_TITLE_TOPICS = [
  '배포',
  '업로드',
  '로그인',
  '보안',
  '세션',
  '게시판',
  '공지',
  '질문',
  '성능',
  '운영',
  '백업',
  '점검',
  '장애',
  '리팩터링',
  '정책',
  '가이드',
  '문서',
  '모니터링',
] as const;

const KOREAN_TITLE_ACTIONS = [
  '점검',
  '공유',
  '요청',
  '후기',
  '정리',
  '계획',
  '문의',
  '수정',
  '확인',
  '메모',
] as const;

const KOREAN_CONTENT_LINES = [
  '오늘 작업하면서 확인한 내용을 간단히 정리합니다.',
  '재현 경로와 결과를 남겨두니 참고 부탁드립니다.',
  '다음 배포 전에 체크해야 할 항목을 함께 적어둡니다.',
  '로그를 확인해 보니 특정 구간에서 지연이 반복되었습니다.',
  '테스트 환경에서는 동일한 조건에서 문제가 재현되지 않았습니다.',
  '운영 반영 전 검토가 필요한 항목이라 먼저 공유합니다.',
  '첨부 파일과 이미지를 보면 상황을 빠르게 파악할 수 있습니다.',
  '추가 의견이 있으면 댓글로 남겨주시면 반영하겠습니다.',
  '원인 후보를 두 가지로 좁혔고 내일 오전에 추가 확인 예정입니다.',
  '현재까지 영향 범위는 제한적이며 우선순위를 올려 처리 중입니다.',
  '재시도 시 정상 동작하지만 간헐적으로 실패가 발생했습니다.',
  '사용자 문의 기준으로 안내 문구도 함께 보완할 예정입니다.',
] as const;

const ENGLISH_TITLE_TOPICS = [
  'Release',
  'Upload',
  'Security',
  'Session',
  'Board',
  'QnA',
  'Ops',
  'Monitoring',
  'Auth',
  'Policy',
] as const;

const ENGLISH_TITLE_ACTIONS = [
  'update',
  'check',
  'note',
  'review',
  'question',
  'follow-up',
  'summary',
  'status',
] as const;

const ENGLISH_CONTENT_LINES = [
  'Sharing a short update from the latest verification run.',
  'The issue appears only under a narrow timing window.',
  'I attached a sample so the behavior can be reproduced quickly.',
  'No regression was found in the baseline scenario.',
  'Please review the edge case before the next rollout.',
  'I will post a follow-up once the logs are compared.',
  'The current fix is stable in staging so far.',
  'A minor wording update is also included for clarity.',
] as const;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
] as const;

const WEEKDAY_WEIGHTS = [0.9, 1.15, 1.2, 1.18, 1.12, 1.0, 0.88] as const;
const HOUR_WEIGHTS = [
  2.8, 2.6, 1.1, 0.8, 0.3, 0.3, 0.35, 0.55, 0.9, 1.2, 1.45, 1.8, 3.0, 2.85, 1.95, 1.7, 1.7, 1.8,
  2.0, 2.35, 3.0, 2.9, 2.7, 2.45,
] as const;

const NOW = new Date();
const POST_START_DATE = new Date('2025-01-01T00:00:00.000Z');
const USER_START_DATE = new Date('2025-01-01T00:00:00.000Z');
const USER_END_DATE = new Date('2025-07-31T23:59:59.999Z');
const AUDIT_START_DATE = new Date('2025-01-01T00:00:00.000Z');

type BoardSlug = (typeof BOARD_DISTRIBUTION)[number]['key'];
type MediaCase = (typeof POST_MEDIA_DISTRIBUTION)[number]['key'];
type LengthKind = (typeof POST_LENGTH_DISTRIBUTION)[number]['key'];
type LanguageKind = (typeof POST_LANGUAGE_DISTRIBUTION)[number]['key'];
type AuditActivity = (typeof AUDIT_ACTIVITY_DISTRIBUTION)[number]['key'];

type SeedUserGroup = 'admin' | 'pentest' | 'general';

type SeedUserRecord = {
  userId: number;
  username: string;
  userRole: 'admin' | 'user';
  group: SeedUserGroup;
};

type SeedBoardRecord = {
  boardId: number;
  slug: BoardSlug;
};

type PendingPost = {
  boardSlug: BoardSlug;
  boardId: number;
  displayId: number;
  authorUserId: number;
  createdAt: Date;
  language: LanguageKind;
  lengthKind: LengthKind;
  title: string;
  content: string;
};

type StoredPostRow = {
  postId: number;
  boardId: number;
  displayId: number;
  boardSlug: BoardSlug;
  authorUserId: number;
  createdAt: Date;
};

type SessionSlot = {
  sessionId: number;
  indexInSession: number;
  sessionLength: number;
  timestamp: Date;
  actor: SeedUserRecord | null;
  ipAddress: string;
  userAgent: string;
};

type ActivitySelectionState = {
  loggedIn: boolean;
};

type ParsedArgs = {
  seedText: string;
  auditCount: number;
};

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function toInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(): ParsedArgs {
  const seedArg = process.argv.find((arg) => arg.startsWith('--seed='));
  const auditCountArg = process.argv.find((arg) => arg.startsWith('--audit-count='));

  return {
    seedText: seedArg ? seedArg.slice('--seed='.length) : DEFAULT_SEED_TEXT,
    auditCount: Math.max(
      40_000,
      Math.min(
        60_000,
        toInt(
          auditCountArg ? auditCountArg.slice('--audit-count='.length) : undefined,
          DEFAULT_AUDIT_LOG_COUNT
        )
      )
    ),
  };
}

function makeRng(seedText: string): () => number {
  const hash = crypto.createHash('sha256').update(seedText).digest();
  let state = hash.readUInt32BE(0) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(rng() * span);
}

function shuffleInPlace<T>(rng: () => number, items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = items[i];
    items[i] = items[j] as T;
    items[j] = temp as T;
  }
}

function pickOne<T>(rng: () => number, items: readonly T[]): T {
  assertCondition(items.length > 0, 'cannot pick from empty array');
  const idx = Math.floor(rng() * items.length);
  const picked = items[idx];
  assertCondition(typeof picked !== 'undefined', 'picked value is undefined');
  return picked;
}

function pickWeighted<T>(rng: () => number, items: ReadonlyArray<{ item: T; weight: number }>): T {
  let totalWeight = 0;
  for (const item of items) {
    if (item.weight > 0) {
      totalWeight += item.weight;
    }
  }
  assertCondition(totalWeight > 0, 'weighted pick totalWeight must be positive');

  let threshold = rng() * totalWeight;
  for (const item of items) {
    if (item.weight <= 0) {
      continue;
    }
    threshold -= item.weight;
    if (threshold <= 0) {
      return item.item;
    }
  }

  const fallback = items[items.length - 1];
  assertCondition(typeof fallback !== 'undefined', 'weighted pick fallback missing');
  return fallback.item;
}

function allocateByRatios<K extends string>(
  total: number,
  ratios: ReadonlyArray<{ key: K; ratio: number }>
): Record<K, number> {
  const allocation = {} as Record<K, number>;
  const remainders: Array<{ key: K; remainder: number }> = [];

  let floorSum = 0;
  for (const entry of ratios) {
    const exact = total * entry.ratio;
    const floored = Math.floor(exact);
    allocation[entry.key] = floored;
    floorSum += floored;
    remainders.push({ key: entry.key, remainder: exact - floored });
  }

  let remaining = total - floorSum;
  remainders.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return String(a.key).localeCompare(String(b.key));
  });

  for (const entry of remainders) {
    if (remaining <= 0) {
      break;
    }
    allocation[entry.key] += 1;
    remaining -= 1;
  }

  const allocatedSum = (Object.values(allocation) as number[]).reduce(
    (sum, value) => sum + value,
    0
  );
  assertCondition(allocatedSum === total, `allocation sum mismatch: total=${total}`);

  return allocation;
}

async function listFilesAbsolute(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
}

async function clearGeneratedFiles(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.name !== '.gitkeep')
      .map((entry) => fs.rm(path.join(dirPath, entry.name), { recursive: true, force: true }))
  );
}

async function resetDatabase(): Promise<void> {
  await sequelize.query(
    `
        TRUNCATE TABLE
            audit_logs,
            posts,
            board_post_counters,
            boards,
            users
        RESTART IDENTITY CASCADE
        `,
    { type: QueryTypes.RAW }
  );
}
function titleCase(value: string): string {
  return value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function buildPrivateIp(rng: () => number): string {
  const rangeChoice = rng();
  if (rangeChoice < 0.6) {
    return `10.${randomInt(rng, 0, 255)}.${randomInt(rng, 0, 255)}.${randomInt(rng, 2, 254)}`;
  }
  if (rangeChoice < 0.8) {
    return `172.${randomInt(rng, 16, 31)}.${randomInt(rng, 0, 255)}.${randomInt(rng, 2, 254)}`;
  }
  return `192.168.${randomInt(rng, 0, 255)}.${randomInt(rng, 2, 254)}`;
}

function sampleTimestampInRange(
  rng: () => number,
  start: Date,
  end: Date,
  options?: { recencyBias?: number }
): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  assertCondition(endMs > startMs, 'invalid date range');

  const recencyBias = options?.recencyBias ?? 1;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const u = rng();
    const biased = 1 - Math.pow(u, recencyBias);
    const sampledMs = startMs + biased * (endMs - startMs);
    const candidate = new Date(sampledMs);
    const weekday = candidate.getUTCDay();
    const dayWeight = WEEKDAY_WEIGHTS[weekday] ?? 1;

    const hour = pickWeighted(
      rng,
      HOUR_WEIGHTS.map((weight, idx) => ({ item: idx, weight }))
    );

    candidate.setUTCHours(
      hour,
      randomInt(rng, 0, 59),
      randomInt(rng, 0, 59),
      randomInt(rng, 0, 999)
    );

    if (candidate.getTime() < startMs || candidate.getTime() > endMs) {
      continue;
    }

    if (rng() <= dayWeight / 1.2) {
      return candidate;
    }
  }

  const fallbackMs = startMs + rng() * (endMs - startMs);
  return new Date(fallbackMs);
}

function randomBio(rng: () => number): string {
  const starts = [
    '업무 노트를 빠르게 남기는 개발자',
    '재현 가능한 버그 리포트를 선호하는 운영자',
    '작은 배포 단위를 선호하는 실무자',
    '로그와 지표를 먼저 보는 엔지니어',
    '문서와 코드 동기화를 중요하게 보는 메이커',
    '질문을 먼저 정리하는 협업형 개발자',
  ] as const;

  const tails = [
    '필요한 맥락만 남기고 바로 실행합니다.',
    '작업 전후 체크리스트를 항상 업데이트합니다.',
    '리뷰 가능한 단위로 나눠서 변경합니다.',
    '문제 발생 시 재현 절차를 우선 공유합니다.',
    '운영 영향도를 먼저 확인한 뒤 반영합니다.',
  ] as const;

  return `${pickOne(rng, starts)}. ${pickOne(rng, tails)}`;
}

async function seedUsers(rng: () => number): Promise<SeedUserRecord[]> {
  const usernames = [...ADMIN_USERNAMES, ...PENTEST_USERNAMES, ...GENERAL_USERNAMES];

  assertCondition(
    usernames.length === TOTAL_USERS,
    `user count mismatch: expected ${TOTAL_USERS}, got ${usernames.length}`
  );

  const now = NOW;
  const userRows = usernames.map((username) => {
    const group: SeedUserGroup = ADMIN_USERNAMES.includes(
      username as (typeof ADMIN_USERNAMES)[number]
    )
      ? 'admin'
      : PENTEST_USERNAMES.includes(username as (typeof PENTEST_USERNAMES)[number])
        ? 'pentest'
        : 'general';
    const userRole: 'admin' | 'user' = group === 'admin' ? 'admin' : 'user';
    const createdAt = sampleTimestampInRange(rng, USER_START_DATE, USER_END_DATE, {
      recencyBias: 1.35,
    });

    return {
      user_role: userRole,
      username,
      password_hash: hashPassword(`${username}1234`),
      is_active: true,
      display_name: titleCase(username.replace(/-/g, ' ')),
      email: `${username.replace(/[^a-z0-9]/g, '') || 'user'}@example.com`,
      phone_number: `010-${String(randomInt(rng, 1000, 9999))}-${String(randomInt(rng, 1000, 9999))}`,
      bio: group === 'admin' ? '운영 정책과 권한 관리를 담당합니다.' : randomBio(rng),
      profile_image_url: null,
      created_at: createdAt,
      updated_at: new Date(
        Math.max(createdAt.getTime(), now.getTime() - randomInt(rng, 1, 30) * 86_400_000)
      ),
    };
  });

  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.bulkInsert('users', userRows);

  const inserted = await sequelize.query<{
    user_id: number;
    username: string;
    user_role: 'admin' | 'user';
  }>(
    `
        SELECT user_id, username, user_role
        FROM users
        ORDER BY user_id ASC
        `,
    { type: QueryTypes.SELECT }
  );

  return inserted.map((row) => {
    const group: SeedUserGroup = ADMIN_USERNAMES.includes(
      row.username as (typeof ADMIN_USERNAMES)[number]
    )
      ? 'admin'
      : PENTEST_USERNAMES.includes(row.username as (typeof PENTEST_USERNAMES)[number])
        ? 'pentest'
        : 'general';

    return {
      userId: Number(row.user_id),
      username: row.username,
      userRole: row.user_role,
      group,
    };
  });
}

async function seedBoards(): Promise<SeedBoardRecord[]> {
  const now = NOW;
  const boards = [
    {
      slug: 'general',
      name: 'General',
      description: 'Open discussions for all visitors.',
      read_access: 'public',
      create_access: 'auth',
      created_at: now,
      updated_at: now,
    },
    {
      slug: 'announcement',
      name: 'Announcement',
      description: 'Admin-only posting board for official notices.',
      read_access: 'public',
      create_access: 'admin',
      created_at: now,
      updated_at: now,
    },
    {
      slug: 'user-only',
      name: 'User Only',
      description: 'Authenticated users only.',
      read_access: 'auth',
      create_access: 'auth',
      created_at: now,
      updated_at: now,
    },
    {
      slug: 'qna',
      name: 'Q&A',
      description: 'Only author and admin can read each post.',
      read_access: 'owner_or_admin',
      create_access: 'auth',
      created_at: now,
      updated_at: now,
    },
  ];

  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.bulkInsert('boards', boards);

  const inserted = await sequelize.query<{ board_id: number; slug: BoardSlug }>(
    `
        SELECT board_id, slug
        FROM boards
        WHERE slug IN ('general', 'announcement', 'user-only', 'qna')
        ORDER BY board_id ASC
        `,
    { type: QueryTypes.SELECT }
  );

  assertCondition(inserted.length === 4, 'failed to insert 4 required boards');

  return inserted.map((row) => ({
    boardId: Number(row.board_id),
    slug: row.slug,
  }));
}

function choosePostAuthor(params: {
  rng: () => number;
  boardSlug: BoardSlug;
  admins: SeedUserRecord[];
  pentests: SeedUserRecord[];
  generals: SeedUserRecord[];
}): SeedUserRecord {
  const { rng, boardSlug, admins, pentests, generals } = params;
  const nonAdmin = [...pentests, ...generals];

  if (boardSlug === 'announcement') {
    return pickOne(rng, admins);
  }

  if (boardSlug === 'qna') {
    if (rng() < 0.95) {
      return pickOne(rng, nonAdmin);
    }
    return pickOne(rng, admins);
  }

  if (boardSlug === 'general') {
    if (rng() < 0.92) {
      return pickOne(rng, nonAdmin);
    }
    return pickOne(rng, admins);
  }

  if (rng() < 0.97) {
    return pickOne(rng, nonAdmin);
  }
  return pickOne(rng, admins);
}

function makeTitle(rng: () => number, language: LanguageKind, boardSlug: BoardSlug): string {
  if (language === 'en') {
    const title = `${pickOne(rng, ENGLISH_TITLE_TOPICS)} ${pickOne(rng, ENGLISH_TITLE_ACTIONS)}`;
    return boardSlug === 'announcement' ? `Announcement: ${title}` : title;
  }

  const title = `${pickOne(rng, KOREAN_TITLE_TOPICS)} ${pickOne(rng, KOREAN_TITLE_ACTIONS)}`;
  return boardSlug === 'announcement' ? `[공지] ${title}` : title;
}

function makeContent(
  rng: () => number,
  language: LanguageKind,
  lengthKind: LengthKind,
  boardSlug: BoardSlug
): string {
  const basePool = language === 'en' ? ENGLISH_CONTENT_LINES : KOREAN_CONTENT_LINES;

  const lineCount =
    lengthKind === 'short'
      ? randomInt(rng, 2, 3)
      : lengthKind === 'medium'
        ? randomInt(rng, 4, 5)
        : randomInt(rng, 7, 9);

  const lines: string[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    lines.push(pickOne(rng, basePool));
  }

  if (boardSlug === 'qna' && language === 'ko') {
    lines.push('질문 의도와 재현 조건을 함께 적어 두었습니다.');
  }
  if (boardSlug === 'announcement' && language === 'ko') {
    lines.push('적용 일정은 공지 하단의 시간표를 참고해 주세요.');
  }

  return lines.join(' ');
}

function assignLanguages(
  rng: () => number,
  posts: Array<Omit<PendingPost, 'language' | 'lengthKind' | 'title' | 'content'>>,
  usersById: Map<number, SeedUserRecord>
): LanguageKind[] {
  const allocation = allocateByRatios(posts.length, POST_LANGUAGE_DISTRIBUTION);
  const englishTarget = allocation.en;

  const scored = posts.map((post, idx) => {
    const user = usersById.get(post.authorUserId);
    const focusBoost = user && ENGLISH_FOCUS_USERS.has(user.username) ? 1 : 0;
    return {
      idx,
      score: rng() + focusBoost,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const englishSet = new Set<number>(scored.slice(0, englishTarget).map((item) => item.idx));

  return posts.map((_, idx) => (englishSet.has(idx) ? 'en' : 'ko'));
}

function assignLengthKinds(rng: () => number, total: number): LengthKind[] {
  const allocation = allocateByRatios(total, POST_LENGTH_DISTRIBUTION);
  const buckets: LengthKind[] = [];
  for (let i = 0; i < allocation.short; i += 1) buckets.push('short');
  for (let i = 0; i < allocation.medium; i += 1) buckets.push('medium');
  for (let i = 0; i < allocation.long; i += 1) buckets.push('long');

  assertCondition(buckets.length === total, 'length bucket mismatch');
  shuffleInPlace(rng, buckets);
  return buckets;
}

function samplePostCreatedAt(rng: () => number): Date {
  const recentStart = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
  const useRecent = rng() < POST_RECENT_RATIO;
  if (useRecent) {
    return sampleTimestampInRange(rng, recentStart, NOW, { recencyBias: 1.55 });
  }

  const olderEnd = new Date(recentStart.getTime() - 1);
  return sampleTimestampInRange(rng, POST_START_DATE, olderEnd, { recencyBias: 1.2 });
}

async function seedPosts(params: {
  rng: () => number;
  boards: SeedBoardRecord[];
  users: SeedUserRecord[];
}): Promise<StoredPostRow[]> {
  const { rng, boards, users } = params;

  const boardCounts = allocateByRatios(TOTAL_POSTS, BOARD_DISTRIBUTION);
  console.log('[seed] board distribution', boardCounts);

  const admins = users.filter((user) => user.group === 'admin');
  const pentests = users.filter((user) => user.group === 'pentest');
  const generals = users.filter((user) => user.group === 'general');

  const boardIdBySlug = new Map<BoardSlug, number>();
  for (const board of boards) {
    boardIdBySlug.set(board.slug, board.boardId);
  }

  const pendingBase: Array<Omit<PendingPost, 'language' | 'lengthKind' | 'title' | 'content'>> = [];

  for (const [slug, count] of Object.entries(boardCounts) as Array<[BoardSlug, number]>) {
    const boardId = boardIdBySlug.get(slug);
    assertCondition(typeof boardId === 'number', `missing board id for ${slug}`);

    for (let displayId = 1; displayId <= count; displayId += 1) {
      const author = choosePostAuthor({ rng, boardSlug: slug, admins, pentests, generals });
      pendingBase.push({
        boardSlug: slug,
        boardId,
        displayId,
        authorUserId: author.userId,
        createdAt: samplePostCreatedAt(rng),
      });
    }
  }

  assertCondition(pendingBase.length === TOTAL_POSTS, 'pending post count mismatch');

  const usersById = new Map<number, SeedUserRecord>(users.map((user) => [user.userId, user]));
  const languages = assignLanguages(rng, pendingBase, usersById);
  const lengthKinds = assignLengthKinds(rng, pendingBase.length);

  const pendingPosts: PendingPost[] = pendingBase.map((base, index) => {
    const language = languages[index] as LanguageKind;
    const lengthKind = lengthKinds[index] as LengthKind;
    return {
      ...base,
      language,
      lengthKind,
      title: makeTitle(rng, language, base.boardSlug),
      content: makeContent(rng, language, lengthKind, base.boardSlug),
    };
  });

  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.bulkInsert(
    'posts',
    pendingPosts.map((post) => ({
      board_id: post.boardId,
      display_id: post.displayId,
      user_id: post.authorUserId,
      title: post.title,
      content: post.content,
      image_url: null,
      file_url: null,
      created_at: post.createdAt,
      updated_at: post.createdAt,
      use_yn: true,
    }))
  );

  const storedRows = await sequelize.query<{
    post_id: number;
    board_id: number;
    display_id: number;
    user_id: number;
    created_at: Date;
  }>(
    `
        SELECT post_id, board_id, display_id, user_id, created_at
        FROM posts
        ORDER BY post_id ASC
        `,
    { type: QueryTypes.SELECT }
  );

  const slugByBoardId = new Map<number, BoardSlug>(
    boards.map((board) => [board.boardId, board.slug])
  );

  const stored = storedRows.map((row) => {
    const slug = slugByBoardId.get(Number(row.board_id));
    assertCondition(
      typeof slug === 'string',
      `missing board slug for board_id=${String(row.board_id)}`
    );

    return {
      postId: Number(row.post_id),
      boardId: Number(row.board_id),
      displayId: Number(row.display_id),
      boardSlug: slug,
      authorUserId: Number(row.user_id),
      createdAt: new Date(row.created_at),
    } as StoredPostRow;
  });

  assertCondition(stored.length === TOTAL_POSTS, `stored post count mismatch: ${stored.length}`);
  return stored;
}
async function attachProfileAvatars(params: {
  rng: () => number;
  users: SeedUserRecord[];
  avatarRawPaths: string[];
}): Promise<void> {
  const { rng, users, avatarRawPaths } = params;
  const generalUsers = users.filter((user) => user.group === 'general');

  const targetCount = Math.round(generalUsers.length * AVATAR_ATTACH_RATE);
  const shuffled = [...generalUsers];
  shuffleInPlace(rng, shuffled);

  const selected = shuffled.slice(0, targetCount);
  console.log(`[seed] avatar attachments: ${selected.length}/${generalUsers.length} generals`);

  for (const user of selected) {
    const rawPath = pickOne(rng, avatarRawPaths);
    await uploadProfileImageFromPath(user.userId, rawPath);
  }

  const adminOrPentestIds = new Set(
    users.filter((user) => user.group !== 'general').map((user) => user.userId)
  );
  await sequelize.query(
    `
        UPDATE users
        SET profile_image_url = NULL,
            updated_at = NOW()
        WHERE user_id IN (:userIds)
        `,
    {
      type: QueryTypes.UPDATE,
      replacements: {
        userIds: Array.from(adminOrPentestIds),
      },
    }
  );
}

function buildMediaCases(rng: () => number): MediaCase[] {
  const allocation = allocateByRatios(TOTAL_POSTS, POST_MEDIA_DISTRIBUTION);
  console.log('[seed] media distribution', allocation);

  const cases: MediaCase[] = [];
  for (let i = 0; i < allocation.image_and_file; i += 1) cases.push('image_and_file');
  for (let i = 0; i < allocation.image_only; i += 1) cases.push('image_only');
  for (let i = 0; i < allocation.file_only; i += 1) cases.push('file_only');
  for (let i = 0; i < allocation.none; i += 1) cases.push('none');

  assertCondition(cases.length === TOTAL_POSTS, 'media case count mismatch');
  shuffleInPlace(rng, cases);
  return cases;
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) {
        return;
      }
      const task = tasks[index];
      assertCondition(typeof task === 'function', 'task missing');
      results[index] = await task();
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function attachPostMedia(params: {
  rng: () => number;
  posts: StoredPostRow[];
  postImageRawPaths: string[];
  fileRawPaths: string[];
}): Promise<void> {
  const { rng, posts, postImageRawPaths, fileRawPaths } = params;
  const cases = buildMediaCases(rng);

  const tasks: Array<() => Promise<void>> = [];

  posts.forEach((post, idx) => {
    const mediaCase = cases[idx];
    assertCondition(typeof mediaCase === 'string', `missing media case for idx=${idx}`);

    tasks.push(async () => {
      let imageUrl: string | null = null;
      let fileUrl: string | null = null;

      if (mediaCase === 'image_and_file' || mediaCase === 'image_only') {
        const rawImagePath = pickOne(rng, postImageRawPaths);
        const stored = await uploadPostImageFromPath(post.postId, rawImagePath);
        imageUrl = stored.storedFilename;
      }

      if (mediaCase === 'image_and_file' || mediaCase === 'file_only') {
        const rawFilePath = pickOne(rng, fileRawPaths);
        const stored = await uploadAttachmentFromPath(post.postId, rawFilePath);
        fileUrl = stored.storedFilename;
      }

      await sequelize.query(
        `
                UPDATE posts
                SET image_url = :imageUrl,
                    file_url = :fileUrl,
                    updated_at = NOW()
                WHERE post_id = :postId
                `,
        {
          type: QueryTypes.UPDATE,
          replacements: {
            postId: post.postId,
            imageUrl,
            fileUrl,
          },
        }
      );
    });
  });

  let completed = 0;
  await runWithConcurrency(
    tasks.map((task) => async () => {
      await task();
      completed += 1;
      if (completed % 100 === 0 || completed === tasks.length) {
        console.log(`[seed] post media progress ${completed}/${tasks.length}`);
      }
    }),
    4
  );

  const [counts] = await sequelize.query<{
    image_count: string;
    file_count: string;
    both_count: string;
    none_count: string;
  }>(
    `
        SELECT
            COUNT(*) FILTER (WHERE image_url IS NOT NULL) AS image_count,
            COUNT(*) FILTER (WHERE file_url IS NOT NULL) AS file_count,
            COUNT(*) FILTER (WHERE image_url IS NOT NULL AND file_url IS NOT NULL) AS both_count,
            COUNT(*) FILTER (WHERE image_url IS NULL AND file_url IS NULL) AS none_count
        FROM posts
        `,
    { type: QueryTypes.SELECT }
  );

  assertCondition(typeof counts !== 'undefined', 'post media count row missing');
  console.log('[seed] media applied', counts);
}

async function refreshBoardCounters(boards: SeedBoardRecord[]): Promise<void> {
  for (const board of boards) {
    const [row] = await sequelize.query<{ max_display_id: string }>(
      `
            SELECT COALESCE(MAX(display_id), 0) AS max_display_id
            FROM posts
            WHERE board_id = :boardId
            `,
      {
        type: QueryTypes.SELECT,
        replacements: { boardId: board.boardId },
      }
    );

    const maxDisplayId = Number(row?.max_display_id ?? 0);
    await sequelize.query(
      `
            INSERT INTO board_post_counters (board_id, next_display_id)
            VALUES (:boardId, :nextDisplayId)
            ON CONFLICT (board_id)
            DO UPDATE SET next_display_id = EXCLUDED.next_display_id
            `,
      {
        type: QueryTypes.INSERT,
        replacements: {
          boardId: board.boardId,
          nextDisplayId: maxDisplayId + 1,
        },
      }
    );
  }
}

function sampleSessionLength(rng: () => number): number {
  const bias = rng();
  if (bias < 0.35) return randomInt(rng, 3, 6);
  if (bias < 0.75) return randomInt(rng, 7, 12);
  return randomInt(rng, 13, 20);
}

function sampleGapMs(rng: () => number): number {
  const choice = rng();
  if (choice < 0.55) {
    return randomInt(rng, 300, 3000);
  }
  if (choice < 0.9) {
    return randomInt(rng, 5000, 40_000);
  }
  return randomInt(rng, 60_000, 600_000);
}

function buildSessionSlots(params: {
  rng: () => number;
  totalEvents: number;
  users: SeedUserRecord[];
}): SessionSlot[] {
  const { rng, totalEvents, users } = params;
  const recentStart = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentTarget = Math.round(totalEvents * AUDIT_RECENT_RATIO);

  const admins = users.filter((user) => user.group === 'admin');
  const members = users.filter((user) => user.group !== 'admin');

  const sessionSlots: SessionSlot[] = [];

  let sessionId = 1;

  const buildRangeSlots = (
    targetEvents: number,
    rangeStart: Date,
    rangeEnd: Date,
    recencyBias: number
  ) => {
    let produced = 0;
    while (produced < targetEvents) {
      const remaining = targetEvents - produced;
      const sessionLength = Math.min(sampleSessionLength(rng), remaining);

      const actorChoice = rng();
      let actor: SeedUserRecord | null = null;
      if (actorChoice < 0.06) {
        actor = null;
      } else if (actorChoice < 0.14) {
        actor = pickOne(rng, admins);
      } else {
        actor = pickOne(rng, members);
      }

      let cursor = sampleTimestampInRange(rng, rangeStart, rangeEnd, { recencyBias });
      const userAgent = pickOne(rng, USER_AGENTS);
      const ipAddress = buildPrivateIp(rng);

      for (let i = 0; i < sessionLength; i += 1) {
        if (i > 0) {
          cursor = new Date(Math.min(rangeEnd.getTime(), cursor.getTime() + sampleGapMs(rng)));
        }

        sessionSlots.push({
          sessionId,
          indexInSession: i,
          sessionLength,
          timestamp: cursor,
          actor,
          ipAddress,
          userAgent,
        });
      }

      produced += sessionLength;
      sessionId += 1;
    }
  };

  buildRangeSlots(recentTarget, recentStart, NOW, 1.6);
  buildRangeSlots(
    totalEvents - recentTarget,
    AUDIT_START_DATE,
    new Date(recentStart.getTime() - 1),
    1.15
  );

  sessionSlots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return sessionSlots;
}
function actionForActivity(activity: AuditActivity): string {
  switch (activity) {
    case 'post_view':
    case 'post_update':
    case 'post_delete':
    case 'post_create':
      return 'ADMIN_PAGE_ACCESS_ATTEMPT';
    case 'login_success':
      return 'LOGIN';
    case 'login_fail':
      return 'LOGIN_FAILED';
    case 'logout':
      return 'LOGOUT';
    case 'authz_denied':
      return 'AUTHZ_DENIED';
    case 'rate_limited':
      return 'RATE_LIMITED';
    case 'password_reset_requested':
      return 'PASSWORD_RESET_REQUESTED';
    case 'password_reset_completed':
      return 'PASSWORD_RESET_COMPLETED';
    case 'account_locked':
      return 'ACCOUNT_LOCKED';
  }
}

function chooseAuditActivity(params: {
  rng: () => number;
  slot: SessionSlot;
  state: ActivitySelectionState;
  remaining: Record<AuditActivity, number>;
}): AuditActivity {
  const { rng, slot, state, remaining } = params;

  const baseWeights: Record<AuditActivity, number> = {
    post_view: state.loggedIn ? 1.2 : 1.0,
    login_success: state.loggedIn ? 0.04 : 0.45,
    login_fail: state.loggedIn ? 0.07 : 0.22,
    post_update: state.loggedIn ? 0.16 : 0.02,
    post_delete: state.loggedIn ? 0.05 : 0.01,
    post_create: state.loggedIn ? 0.12 : 0.03,
    logout: state.loggedIn ? 0.26 : 0.02,
    authz_denied: 0.2,
    rate_limited: 0.08,
    password_reset_requested: 0.05,
    password_reset_completed: state.loggedIn ? 0.04 : 0.01,
    account_locked: 0.04,
  };

  if (slot.indexInSession === 0) {
    baseWeights.login_success *= 2.8;
    baseWeights.login_fail *= 1.9;
  }

  if (slot.indexInSession === slot.sessionLength - 1 && state.loggedIn) {
    baseWeights.logout *= 2.4;
  }

  const totalRemaining = Object.values(remaining).reduce((sum, value) => sum + value, 0);
  assertCondition(totalRemaining > 0, 'remaining activity total must be positive');

  const weightedCandidates: Array<{ item: AuditActivity; weight: number }> = [];
  for (const key of Object.keys(remaining) as AuditActivity[]) {
    const count = remaining[key];
    if (count <= 0) {
      continue;
    }
    const weight = baseWeights[key] * (count / totalRemaining);
    weightedCandidates.push({ item: key, weight });
  }

  if (weightedCandidates.length === 0) {
    const fallback = (Object.keys(remaining) as AuditActivity[]).find((key) => remaining[key] > 0);
    assertCondition(typeof fallback === 'string', 'no fallback activity available');
    return fallback;
  }

  return pickWeighted(rng, weightedCandidates);
}

function buildAuditDetails(params: {
  rng: () => number;
  activity: AuditActivity;
  post: StoredPostRow;
  slot: SessionSlot;
}): Record<string, unknown> {
  const { rng, activity, post, slot } = params;

  const basePath = `/board/${encodeURIComponent(post.boardSlug)}/${String(post.displayId)}`;
  const pathByActivity: Record<AuditActivity, string> = {
    post_view: basePath,
    post_create: `/board/${encodeURIComponent(post.boardSlug)}`,
    post_update: `${basePath}/edit`,
    post_delete: `${basePath}/delete`,
    login_success: '/login',
    login_fail: '/login',
    logout: '/logout',
    authz_denied: basePath,
    rate_limited: '/login',
    password_reset_requested: '/forgot-password',
    password_reset_completed: '/reset-password',
    account_locked: '/login',
  };

  const methodByActivity: Record<AuditActivity, string> = {
    post_view: 'GET',
    post_create: 'POST',
    post_update: 'POST',
    post_delete: 'POST',
    login_success: 'POST',
    login_fail: 'POST',
    logout: 'POST',
    authz_denied: pickOne(rng, ['GET', 'POST'] as const),
    rate_limited: 'POST',
    password_reset_requested: 'POST',
    password_reset_completed: 'POST',
    account_locked: 'POST',
  };

  const details: Record<string, unknown> = {
    activityType: activity,
    sessionId: slot.sessionId,
    method: methodByActivity[activity],
    path: pathByActivity[activity],
    boardSlug: post.boardSlug,
    displayId: post.displayId,
  };

  if (activity === 'post_view') {
    details.result = 'allowed';
    details.reason = 'post_view';
  }
  if (activity === 'post_create') {
    details.result = 'allowed';
    details.reason = 'post_create';
  }
  if (activity === 'post_update') {
    details.result = 'allowed';
    details.reason = 'post_update';
  }
  if (activity === 'post_delete') {
    details.result = 'allowed';
    details.reason = 'post_delete';
  }
  if (activity === 'login_success') {
    details.loginResult = 'success';
  }
  if (activity === 'login_fail') {
    details.loginResult = 'failure';
    details.reason = pickOne(rng, [
      'invalid_password',
      'invalid_username',
      'captcha_required',
    ] as const);
  }
  if (activity === 'authz_denied') {
    details.reason = 'insufficient_permission';
  }
  if (activity === 'rate_limited') {
    details.scope = pickOne(rng, ['login', 'post_mutation'] as const);
    details.keyType = pickOne(rng, ['ip', 'user'] as const);
    details.maxRequests = pickOne(rng, [5, 10, 15] as const);
    details.windowSeconds = pickOne(rng, [30, 60, 120] as const);
    details.retryAfterSeconds = pickOne(rng, [15, 30, 45, 60] as const);
  }
  if (activity === 'password_reset_requested') {
    details.issued = rng() < 0.82;
    details.requestedUsername =
      slot.actor?.username ?? pickOne(rng, [...GENERAL_USERNAMES, ...PENTEST_USERNAMES]);
  }
  if (activity === 'password_reset_completed') {
    details.result = 'success';
  }
  if (activity === 'account_locked') {
    details.failedCount = randomInt(rng, 5, 12);
    details.lockMinutes = pickOne(rng, [10, 20, 30, 60] as const);
    details.passwordResetRequired = true;
  }

  return details;
}

async function seedAuditLogs(params: {
  rng: () => number;
  users: SeedUserRecord[];
  posts: StoredPostRow[];
  auditCount: number;
}): Promise<void> {
  const { rng, users, posts, auditCount } = params;

  const activityTargets = allocateByRatios(auditCount, AUDIT_ACTIVITY_DISTRIBUTION);
  const remaining: Record<AuditActivity, number> = { ...activityTargets };

  const slots = buildSessionSlots({ rng, totalEvents: auditCount, users });
  assertCondition(slots.length === auditCount, 'audit slot count mismatch');

  const stateBySession = new Map<number, ActivitySelectionState>();
  const rows: Array<{
    action: string;
    actor_user_id: number | null;
    actor_username: string | null;
    target_user_id: number | null;
    target_username: string | null;
    details: Record<string, unknown>;
    ip_address: string;
    user_agent: string;
    created_at: Date;
  }> = [];

  const usersById = new Map<number, SeedUserRecord>(users.map((user) => [user.userId, user]));

  for (const slot of slots) {
    const state = stateBySession.get(slot.sessionId) ?? { loggedIn: false };
    const activity = chooseAuditActivity({ rng, slot, state, remaining });
    remaining[activity] -= 1;

    const post = pickOne(rng, posts);
    const details = buildAuditDetails({ rng, activity, post, slot });

    let actor = slot.actor;
    if (
      (activity === 'login_success' ||
        activity === 'logout' ||
        activity === 'post_create' ||
        activity === 'post_update' ||
        activity === 'post_delete') &&
      !actor
    ) {
      actor = pickOne(rng, users);
    }

    let target: SeedUserRecord | null = null;
    if (
      activity === 'login_success' ||
      activity === 'logout' ||
      activity === 'password_reset_completed' ||
      activity === 'account_locked'
    ) {
      target = actor;
    } else if (activity === 'login_fail') {
      if (rng() < 0.65) {
        target = pickOne(rng, users);
      }
    } else if (activity === 'password_reset_requested') {
      target = rng() < 0.7 ? pickOne(rng, users) : null;
    } else if (rng() < 0.2) {
      target = usersById.get(post.authorUserId) ?? null;
    }

    if (activity === 'login_success') {
      state.loggedIn = true;
    } else if (activity === 'logout') {
      state.loggedIn = false;
    }
    stateBySession.set(slot.sessionId, state);

    rows.push({
      action: actionForActivity(activity),
      actor_user_id: actor?.userId ?? null,
      actor_username: actor?.username ?? null,
      target_user_id: target?.userId ?? null,
      target_username: target?.username ?? null,
      details,
      ip_address: slot.ipAddress,
      user_agent: slot.userAgent,
      created_at: slot.timestamp,
    });
  }

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const replacements: Record<string, unknown> = {};
    const tuples: string[] = [];

    chunk.forEach((row, idx) => {
      const suffix = `_${String(idx)}`;
      replacements[`action${suffix}`] = row.action;
      replacements[`actorUserId${suffix}`] = row.actor_user_id;
      replacements[`actorUsername${suffix}`] = row.actor_username;
      replacements[`targetUserId${suffix}`] = row.target_user_id;
      replacements[`targetUsername${suffix}`] = row.target_username;
      replacements[`detailsJson${suffix}`] = JSON.stringify(row.details);
      replacements[`ipAddress${suffix}`] = row.ip_address;
      replacements[`userAgent${suffix}`] = row.user_agent;
      replacements[`createdAt${suffix}`] = row.created_at;

      tuples.push(
        `(:action${suffix}, :actorUserId${suffix}, :actorUsername${suffix}, :targetUserId${suffix}, :targetUsername${suffix}, CAST(:detailsJson${suffix} AS jsonb), :ipAddress${suffix}, :userAgent${suffix}, :createdAt${suffix})`
      );
    });

    await sequelize.query(
      `
            INSERT INTO audit_logs (
                action,
                actor_user_id,
                actor_username,
                target_user_id,
                target_username,
                details,
                ip_address,
                user_agent,
                created_at
            )
            VALUES ${tuples.join(',\n')}
            `,
      {
        type: QueryTypes.INSERT,
        replacements,
      }
    );
    const done = Math.min(i + chunkSize, rows.length);
    if (done % 5000 === 0 || done === rows.length) {
      console.log(`[seed] audit logs progress ${done}/${rows.length}`);
    }
  }

  const [auditSummary] = await sequelize.query<{
    total_count: string;
    recent_90d_count: string;
  }>(
    `
        SELECT
            COUNT(*) AS total_count,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days') AS recent_90d_count
        FROM audit_logs
        `,
    { type: QueryTypes.SELECT }
  );

  assertCondition(typeof auditSummary !== 'undefined', 'audit summary missing');
  console.log('[seed] audit summary', {
    ...auditSummary,
    activityTargets,
  });
}

async function loadRawAssets(repoRoot: string): Promise<{
  avatarRawPaths: string[];
  postImageRawPaths: string[];
  fileRawPaths: string[];
}> {
  const avatarDir = path.join(repoRoot, 'seed-assets', 'raw', 'avatars');
  const postImageDir = path.join(repoRoot, 'seed-assets', 'raw', 'post-images');
  const fileDir = path.join(repoRoot, 'seed-assets', 'raw', 'files');

  const avatarRawPaths = (await listFilesAbsolute(avatarDir)).filter(
    (filePath) => path.extname(filePath).toLowerCase() === '.webp'
  );

  const postImageRawPaths = (await listFilesAbsolute(postImageDir)).filter((filePath) =>
    ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(filePath).toLowerCase())
  );

  const allowedExtensions = new Set(
    Array.from(ARTICLE_ATTACHMENT_EXTENSIONS).map((ext) => ext.toLowerCase())
  );
  const fileRawPaths = (await listFilesAbsolute(fileDir)).filter((filePath) =>
    allowedExtensions.has(path.extname(filePath).toLowerCase())
  );

  assertCondition(avatarRawPaths.length > 0, 'no avatar raw webp found in seed-assets/raw/avatars');
  assertCondition(
    postImageRawPaths.length > 0,
    'no post-image raw files found in seed-assets/raw/post-images'
  );
  assertCondition(
    fileRawPaths.length > 0,
    'no allowed attachment raw files found in seed-assets/raw/files'
  );

  return { avatarRawPaths, postImageRawPaths, fileRawPaths };
}

async function validateDistributionGuards(): Promise<void> {
  const [postTotal] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM posts`,
    { type: QueryTypes.SELECT }
  );
  assertCondition(
    Number(postTotal?.count ?? 0) === TOTAL_POSTS,
    `post total mismatch after seeding: ${postTotal?.count ?? '0'}`
  );

  const [userTotal] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users`,
    { type: QueryTypes.SELECT }
  );
  assertCondition(
    Number(userTotal?.count ?? 0) === TOTAL_USERS,
    `user total mismatch after seeding: ${userTotal?.count ?? '0'}`
  );

  const boardRows = await sequelize.query<{
    slug: string;
    count: string;
  }>(
    `
        SELECT b.slug, COUNT(p.post_id)::text AS count
        FROM boards b
        LEFT JOIN posts p ON p.board_id = b.board_id AND p.use_yn = true
        GROUP BY b.slug
        ORDER BY b.slug
        `,
    { type: QueryTypes.SELECT }
  );

  const boardMap = new Map(boardRows.map((row) => [row.slug, Number(row.count)]));
  const expectedBoard = allocateByRatios(TOTAL_POSTS, BOARD_DISTRIBUTION);

  for (const [slug, expected] of Object.entries(expectedBoard)) {
    const actual = boardMap.get(slug) ?? 0;
    assertCondition(
      actual === expected,
      `board count mismatch for ${slug}: expected=${expected}, actual=${actual}`
    );
  }

  const [attachmentGuard] = await sequelize.query<{
    too_many_images: string;
    too_many_files: string;
  }>(
    `
        SELECT
            COUNT(*) FILTER (WHERE image_url IS NOT NULL AND POSITION(',' IN image_url) > 0) AS too_many_images,
            COUNT(*) FILTER (WHERE file_url IS NOT NULL AND POSITION(',' IN file_url) > 0) AS too_many_files
        FROM posts
        `,
    { type: QueryTypes.SELECT }
  );

  assertCondition(
    Number(attachmentGuard?.too_many_images ?? 0) === 0,
    'invalid multi-image representation detected'
  );
  assertCondition(
    Number(attachmentGuard?.too_many_files ?? 0) === 0,
    'invalid multi-file representation detected'
  );
}
async function main(): Promise<void> {
  const args = parseArgs();
  const rng = makeRng(args.seedText);

  const repoRoot = path.resolve(process.cwd(), '..');

  console.log('[seed] starting realistic seed', {
    seedText: args.seedText,
    totalUsers: TOTAL_USERS,
    totalPosts: TOTAL_POSTS,
    auditCount: args.auditCount,
  });

  const { avatarRawPaths, postImageRawPaths, fileRawPaths } = await loadRawAssets(repoRoot);

  await Promise.all([
    clearGeneratedFiles(AVATAR_IMAGE_UPLOAD_DIR),
    clearGeneratedFiles(ARTICLE_IMAGE_UPLOAD_DIR),
    clearGeneratedFiles(ARTICLE_ATTACHMENT_UPLOAD_DIR),
  ]);

  await resetDatabase();

  const users = await seedUsers(rng);
  const boards = await seedBoards();

  await attachProfileAvatars({ rng, users, avatarRawPaths });

  const posts = await seedPosts({ rng, boards, users });
  await attachPostMedia({ rng, posts, postImageRawPaths, fileRawPaths });
  await refreshBoardCounters(boards);

  await seedAuditLogs({ rng, users, posts, auditCount: args.auditCount });
  await validateDistributionGuards();

  console.log('[seed] completed successfully');
}

try {
  await main();
} finally {
  await closeDb();
}
