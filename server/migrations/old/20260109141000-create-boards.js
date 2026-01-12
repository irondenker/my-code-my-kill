'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 게시판 메타데이터 테이블
    await queryInterface.createTable("boards", {
      board_id: {
        // 게시판 내부 PK (자동 증가)
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      slug: {
        // URL 식별자 (예: /board/notice)
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      name: {
        // 화면 표시용 게시판 이름
        type: Sequelize.STRING(100),
        allowNull: false,
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
  },

  async down(queryInterface) {
    // 롤백: boards 테이블 삭제
    await queryInterface.dropTable("boards");
  },
};
