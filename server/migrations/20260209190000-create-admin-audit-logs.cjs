'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        audit_log_id BIGSERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        actor_user_id BIGINT NULL,
        actor_username VARCHAR(50) NULL,
        target_user_id BIGINT NULL,
        target_username VARCHAR(50) NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_action_check'
        ) THEN
          ALTER TABLE admin_audit_logs
          ADD CONSTRAINT admin_audit_logs_action_check
          CHECK (
            action IN (
              'ADMIN_LOGIN',
              'ADMIN_LOGOUT',
              'ACCOUNT_CREATED',
              'ACCOUNT_ACTIVATED',
              'ACCOUNT_DEACTIVATED',
              'ADMIN_GRANTED',
              'ADMIN_REVOKED'
            )
          );
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
      ON admin_audit_logs (created_at DESC);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_user_id
      ON admin_audit_logs (actor_user_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_id
      ON admin_audit_logs (target_user_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS admin_audit_logs;
    `);
  },
};
