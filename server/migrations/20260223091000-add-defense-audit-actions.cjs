'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs
      DROP CONSTRAINT IF EXISTS audit_logs_action_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_action_check
      CHECK (
        action IN (
          'LOGIN',
          'LOGIN_FAILED',
          'LOGOUT',
          'ACCOUNT_CREATED',
          'ACCOUNT_ACTIVATED',
          'ACCOUNT_DEACTIVATED',
          'ADMIN_GRANTED',
          'ADMIN_REVOKED',
          'AUTHZ_DENIED',
          'CSRF_INVALID',
          'ADMIN_PAGE_ACCESS_ATTEMPT',
          'PASSWORD_RESET_REQUESTED',
          'PASSWORD_RESET_COMPLETED',
          'ACCOUNT_LOCKED',
          'RATE_LIMITED'
        )
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE audit_logs
      SET action = 'LOGIN_FAILED'
      WHERE action IN (
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_COMPLETED',
        'ACCOUNT_LOCKED',
        'RATE_LIMITED'
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs
      DROP CONSTRAINT IF EXISTS audit_logs_action_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_action_check
      CHECK (
        action IN (
          'LOGIN',
          'LOGIN_FAILED',
          'LOGOUT',
          'ACCOUNT_CREATED',
          'ACCOUNT_ACTIVATED',
          'ACCOUNT_DEACTIVATED',
          'ADMIN_GRANTED',
          'ADMIN_REVOKED',
          'AUTHZ_DENIED',
          'CSRF_INVALID',
          'ADMIN_PAGE_ACCESS_ATTEMPT'
        )
      );
    `);
  },
};
