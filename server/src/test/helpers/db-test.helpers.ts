import { QueryTypes } from 'sequelize';
import { sequelize } from '../../db/index.js';

export const runDbTests = process.env.RUN_DB_TESTS === '1';
export const skipReason = runDbTests
  ? undefined
  : 'Set RUN_DB_TESTS=1 to run DB integration tests.';

export function makeId(prefix: string): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${entropy}`;
}

export async function cleanupUserById(userId: number): Promise<void> {
  await sequelize.query(
    `
        DELETE FROM users
        WHERE user_id = :userId
        `,
    { replacements: { userId }, type: QueryTypes.DELETE }
  );
}

export async function cleanupUserByUsername(username: string): Promise<void> {
  await sequelize.query(
    `
        DELETE FROM users
        WHERE username = :username
        `,
    { replacements: { username }, type: QueryTypes.DELETE }
  );
}

export async function cleanupBoard(boardId: number): Promise<void> {
  await sequelize.query(
    `
        DELETE FROM posts
        WHERE board_id = :boardId
        `,
    { replacements: { boardId }, type: QueryTypes.DELETE }
  );

  await sequelize.query(
    `
        DELETE FROM board_post_counters
        WHERE board_id = :boardId
        `,
    { replacements: { boardId }, type: QueryTypes.DELETE }
  );

  await sequelize.query(
    `
        DELETE FROM boards
        WHERE board_id = :boardId
        `,
    { replacements: { boardId }, type: QueryTypes.DELETE }
  );
}

export async function setUserRole(userId: number, role: 'admin' | 'user'): Promise<void> {
  await sequelize.query(
    `
        UPDATE users
        SET user_role = :role,
            updated_at = NOW()
        WHERE user_id = :userId
        `,
    { replacements: { userId, role }, type: QueryTypes.UPDATE }
  );
}

export async function setUserActive(userId: number, isActive: boolean): Promise<void> {
  await sequelize.query(
    `
        UPDATE users
        SET is_active = :isActive,
            updated_at = NOW()
        WHERE user_id = :userId
        `,
    { replacements: { userId, isActive }, type: QueryTypes.UPDATE }
  );
}
