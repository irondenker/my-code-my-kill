'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE boards
      ADD COLUMN IF NOT EXISTS read_access VARCHAR(30) NOT NULL DEFAULT 'public';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE boards
      ADD COLUMN IF NOT EXISTS create_access VARCHAR(30) NOT NULL DEFAULT 'auth';
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'boards_read_access_check'
        ) THEN
          ALTER TABLE boards
          ADD CONSTRAINT boards_read_access_check
          CHECK (read_access IN ('public', 'auth', 'admin', 'owner_or_admin'));
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'boards_create_access_check'
        ) THEN
          ALTER TABLE boards
          ADD CONSTRAINT boards_create_access_check
          CHECK (create_access IN ('auth', 'admin'));
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      UPDATE boards
      SET read_access = 'public',
          create_access = CASE WHEN slug = 'announcement' THEN 'admin' ELSE 'auth' END,
          updated_at = NOW()
      WHERE slug IN ('general', 'announcement');
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO boards (slug, name, description, read_access, create_access, created_at, updated_at)
      VALUES
        (
          'useronly',
          'User Only',
          'Private board visible to authenticated users only.',
          'auth',
          'auth',
          NOW(),
          NOW()
        ),
        (
          'qna',
          'Q&A',
          'Private Q&A board where only the author and admins can read each post.',
          'owner_or_admin',
          'auth',
          NOW(),
          NOW()
        )
      ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          read_access = EXCLUDED.read_access,
          create_access = EXCLUDED.create_access,
          updated_at = NOW();
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO board_post_counters (board_id, next_display_id)
      SELECT board_id, 1
      FROM boards
      WHERE slug IN ('useronly', 'qna')
      ON CONFLICT (board_id) DO NOTHING;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM posts
      WHERE board_id IN (SELECT board_id FROM boards WHERE slug IN ('useronly', 'qna'));
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM board_post_counters
      WHERE board_id IN (SELECT board_id FROM boards WHERE slug IN ('useronly', 'qna'));
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM boards
      WHERE slug IN ('useronly', 'qna');
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE boards
      DROP CONSTRAINT IF EXISTS boards_read_access_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE boards
      DROP CONSTRAINT IF EXISTS boards_create_access_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE boards
      DROP COLUMN IF EXISTS read_access;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE boards
      DROP COLUMN IF EXISTS create_access;
    `);
  },
};

