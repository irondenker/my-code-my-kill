'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE admin_audit_logs
      DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_action_check
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

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE admin_audit_logs
      SET action = 'LOGIN'
      WHERE action IN (
        'LOGIN_FAILED',
        'AUTHZ_DENIED',
        'CSRF_INVALID',
        'ADMIN_PAGE_ACCESS_ATTEMPT'
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE admin_audit_logs
      DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_action_check
      CHECK (
        action IN (
          'LOGIN',
          'LOGOUT',
          'ACCOUNT_CREATED',
          'ACCOUNT_ACTIVATED',
          'ACCOUNT_DEACTIVATED',
          'ADMIN_GRANTED',
          'ADMIN_REVOKED'
        )
      );
    `);
  },
};
