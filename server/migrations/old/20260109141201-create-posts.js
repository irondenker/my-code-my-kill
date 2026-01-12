'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("posts", {
      post_id: {
        // 내부 PK (자동 증가)
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      board_id: {
        // 어떤 게시판의 글인지 연결
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: "boards",
          key: "board_id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      display_id: {
        // 게시판 내부에서 보이는 글 번호 (board_id 기준으로 1,2,3...)
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      user_id: {
        // 작성자 (users.user_id 참조)
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: "users",
          key: "user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      title: {
        // 글 제목
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      content: {
        // 글 본문
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_url: {
        // 첨부 파일/이미지 URL (없으면 null)
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
      use_yn: {
        // 논리 삭제 여부 (true=사용중, false=삭제)
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    });

    // 게시판 내 display_id는 중복되지 않도록 유니크 처리
    await queryInterface.addIndex("posts", ["board_id", "display_id"], { unique: true });

    // 작성자 기준 조회 성능 개선용 인덱스
    await queryInterface.addIndex("posts", ["user_id"]);
  },

  async down(queryInterface) {
    // 롤백: posts 테이블 삭제
    await queryInterface.dropTable("posts");
  },
};
