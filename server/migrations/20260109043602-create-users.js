'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      user_id: {
        // 내부 PK (자동 증가)
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },

      user_role: {
        // 권한 구분 (예: admin, user)
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      username: {
        // 로그인/표시용 고유 핸들
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },

      password_hash: {
        // 비밀번호 해시
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      display_name: {
        // 화면 표시용 이름 (nullable)
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      email: {
        // 이메일 (nullable + unique)
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },

      phone_number: {
        // 전화번호 (nullable)
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      bio: {
        // 자기소개 (nullable)
        type: Sequelize.TEXT,
        allowNull: true,
      },

      created_at: {
        // 생성 시각
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        // 수정 시각
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    // 역할 값 체크 (admin/user만 허용)
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      ADD CONSTRAINT users_user_role_check
      CHECK (user_role IN ('admin', 'user'));
    `);
  },

  async down(queryInterface) {
    // 롤백: users 테이블 삭제
    await queryInterface.dropTable("users");
  }
};
