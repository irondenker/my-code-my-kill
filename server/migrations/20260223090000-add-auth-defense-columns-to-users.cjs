'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "login_failed_count", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("users", "login_locked_until", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "password_reset_required", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("users", "password_reset_token_hash", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "password_reset_token_expires_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "password_reset_requested_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "password_reset_used_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "password_reset_used_at");
    await queryInterface.removeColumn("users", "password_reset_requested_at");
    await queryInterface.removeColumn("users", "password_reset_token_expires_at");
    await queryInterface.removeColumn("users", "password_reset_token_hash");
    await queryInterface.removeColumn("users", "password_reset_required");
    await queryInterface.removeColumn("users", "login_locked_until");
    await queryInterface.removeColumn("users", "login_failed_count");
  },
};
