'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 게시판별 display_id 카운터 테이블
    await queryInterface.createTable("board_post_counters", {
      board_id: {
        // 게시판당 1개 카운터 행
        type: Sequelize.BIGINT,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "boards",
          key: "board_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      next_display_id: {
        // 다음에 발급할 display_id 값
        type: Sequelize.BIGINT,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    // 롤백: board_post_counters 테이블 삭제
    await queryInterface.dropTable("board_post_counters");
  },
};
