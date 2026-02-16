'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
        ) THEN
          ALTER TABLE admin_audit_logs RENAME TO audit_logs;
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_action_check'
        ) THEN
          ALTER TABLE audit_logs
          RENAME CONSTRAINT admin_audit_logs_action_check TO audit_logs_action_check;
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER INDEX IF EXISTS idx_admin_audit_logs_created_at
      RENAME TO idx_audit_logs_created_at;
    `);

    await queryInterface.sequelize.query(`
      ALTER INDEX IF EXISTS idx_admin_audit_logs_actor_user_id
      RENAME TO idx_audit_logs_actor_user_id;
    `);

    await queryInterface.sequelize.query(`
      ALTER INDEX IF EXISTS idx_admin_audit_logs_target_user_id
      RENAME TO idx_audit_logs_target_user_id;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'audit_logs'
        ) THEN
          ALTER TABLE audit_logs RENAME TO admin_audit_logs;
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_action_check'
        ) THEN
          ALTER TABLE admin_audit_logs
          RENAME CONSTRAINT audit_logs_action_check TO admin_audit_logs_action_check;
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER INDEX IF EXISTS idx_audit_logs_created_at
      RENAME TO idx_admin_audit_logs_created_at;
    `);

    await queryInterface.sequelize.query(`
      ALTER INDEX IF EXISTS idx_audit_logs_actor_user_id
      RENAME TO idx_admin_audit_logs_actor_user_id;
    `);

    await queryInterface.sequelize.query(`
      ALTER INDEX IF EXISTS idx_audit_logs_target_user_id
      RENAME TO idx_admin_audit_logs_target_user_id;
    `);
  },
};
