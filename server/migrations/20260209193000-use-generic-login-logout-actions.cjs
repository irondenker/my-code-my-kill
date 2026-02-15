'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE admin_audit_logs
      DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check;
    `);

    await queryInterface.sequelize.query(`
      UPDATE admin_audit_logs
      SET action = 'LOGIN'
      WHERE action = 'ADMIN_LOGIN';
    `);

    await queryInterface.sequelize.query(`
      UPDATE admin_audit_logs
      SET action = 'LOGOUT'
      WHERE action = 'ADMIN_LOGOUT';
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

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE admin_audit_logs
      DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check;
    `);

    await queryInterface.sequelize.query(`
      UPDATE admin_audit_logs
      SET action = 'ADMIN_LOGIN'
      WHERE action = 'LOGIN';
    `);

    await queryInterface.sequelize.query(`
      UPDATE admin_audit_logs
      SET action = 'ADMIN_LOGOUT'
      WHERE action = 'LOGOUT';
    `);

    await queryInterface.sequelize.query(`
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
    `);
  },
};
