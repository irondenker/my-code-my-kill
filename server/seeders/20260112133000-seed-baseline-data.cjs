'use strict';

const crypto = require("node:crypto");

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = crypto
    .scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
    .toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function makeRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function titleCase(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const rng = makeRng(crypto.randomInt(0, 0xffffffff));
    const now = new Date();

    const userNames = [
      "adrian",
      "alice",
      "allen",
      "amber",
      "bruno",
      "carson",
      "diana",
      "elena",
      "felix",
      "grace",
      "hansel",
      "irene",
      "jared",
      "karen",
      "kevin",
      "louis",
      "mason",
      "nolan",
      "oliver",
      "peter",
      "quinn",
      "rachel",
      "samuel",
      "taylor",
      "ursula",
      "victor",
      "warren",
      "xavier",
      "yvette",
      "zack",
    ];

    const bioStarts = [
      "Coffee-first coder",
      "Quiet builder",
      "Night-owl tinkerer",
      "Weekend debugger",
      "Minimalist maker",
      "Curious reader",
      "Small-team enjoyer",
      "API-first thinker",
      "UI polishing fan",
      "Docs over chaos believer",
      "Test-driven learner",
      "Refactor-friendly dev",
      "Checklist keeper",
      "Clean commit fan",
      "Low-noise collaborator",
      "Latency chaser",
      "Bug fixer by habit",
      "Design-system reader",
      "Scripting for fun",
      "Obsessed with naming",
      "Release note writer",
      "Feature flag user",
      "Keyboard-driven builder",
      "Backlog gardener",
      "Pipeline watcher",
      "Error log reader",
      "Sprint planner",
      "Quality gate fan",
      "Edge case hunter",
      "Rollback ready",
    ];

    const bioNotes = [
      "who likes tidy workflows",
      "who keeps notes short",
      "who enjoys small wins",
      "who prefers calm reviews",
      "who ships in small batches",
      "who keeps things readable",
      "who asks before overbuilding",
      "who avoids noisy logs",
      "who writes down assumptions",
      "who trusts checklists",
      "who likes clear diffs",
      "who keeps tests simple",
      "who cares about latency",
      "who checks the footnotes",
      "who likes boring tech",
      "who likes steady progress",
      "who keeps docs current",
      "who prefers fewer meetings",
      "who keeps it practical",
      "who values good defaults",
    ];

    const makeBio = (index) => {
      const start = bioStarts[index % bioStarts.length];
      const note = bioNotes[(index * 3) % bioNotes.length];
      return `${start} ${note}.`;
    };

    const users = [];
    users.push({
      user_role: "admin",
      username: "admin",
      password_hash: hashPassword("admin1234"),
      is_active: true,
      display_name: "Admin",
      email: "admin@example.com",
      phone_number: "010-1000-0000",
      bio: null,
      profile_image_url: null,
      created_at: now,
      updated_at: now,
    });

    users.push({
      user_role: "user",
      username: "pentest",
      password_hash: hashPassword("pentest1234"),
      is_active: true,
      display_name: "Pentest",
      email: "pentest@example.com",
      phone_number: "010-1000-0001",
      bio: "Security-focused tester who keeps notes short.",
      profile_image_url: null,
      created_at: now,
      updated_at: now,
    });

    userNames.forEach((username, index) => {
      users.push({
        user_role: "user",
        username,
        password_hash: hashPassword(`${username}1234`),
        is_active: true,
        display_name: titleCase(username),
        email: `${username}@example.com`,
        phone_number: `010-${String(2000 + index).padStart(4, "0")}-${String(
          4300 + index
        ).padStart(4, "0")}`,
        bio: makeBio(index),
        profile_image_url: null,
        created_at: now,
        updated_at: now,
      });
    });

    for (const user of users) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO users (
          user_role,
          username,
          password_hash,
          is_active,
          display_name,
          email,
          phone_number,
          bio,
          profile_image_url,
          created_at,
          updated_at
        )
        VALUES (
          :user_role,
          :username,
          :password_hash,
          :is_active,
          :display_name,
          :email,
          :phone_number,
          :bio,
          :profile_image_url,
          :created_at,
          :updated_at
        )
        ON CONFLICT (username) DO UPDATE
        SET user_role = EXCLUDED.user_role,
            password_hash = EXCLUDED.password_hash,
            is_active = EXCLUDED.is_active,
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            phone_number = EXCLUDED.phone_number,
            bio = EXCLUDED.bio,
            profile_image_url = EXCLUDED.profile_image_url,
            updated_at = NOW()
        `,
        { replacements: user }
      );
    }

    const boards = [
      {
        slug: "general",
        name: "General",
        description: "Open discussions for everyday topics and free conversation.",
        read_access: "public",
        create_access: "auth",
        created_at: now,
        updated_at: now,
      },
      {
        slug: "announcement",
        name: "Announcement",
        description: "Official updates, notices, and important project news.",
        read_access: "public",
        create_access: "admin",
        created_at: now,
        updated_at: now,
      },
      {
        slug: "useronly",
        name: "User Only",
        description: "Private board visible to authenticated users only.",
        read_access: "auth",
        create_access: "auth",
        created_at: now,
        updated_at: now,
      },
      {
        slug: "qna",
        name: "Q&A",
        description: "Private Q&A board where only the author and admins can read each post.",
        read_access: "owner_or_admin",
        create_access: "auth",
        created_at: now,
        updated_at: now,
      },
    ];

    for (const board of boards) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO boards (
          slug,
          name,
          description,
          read_access,
          create_access,
          created_at,
          updated_at
        )
        VALUES (
          :slug,
          :name,
          :description,
          :read_access,
          :create_access,
          :created_at,
          :updated_at
        )
        ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            read_access = EXCLUDED.read_access,
            create_access = EXCLUDED.create_access,
            updated_at = NOW()
        `,
        { replacements: board }
      );
    }

    const boardRows = await queryInterface.sequelize.query(
      "SELECT board_id, slug FROM boards WHERE slug IN (:slugs)",
      {
        replacements: { slugs: ["general", "announcement", "useronly", "qna"] },
        type: QueryTypes.SELECT,
      }
    );

    const boardIdBySlug = {};
    boardRows.forEach((row) => {
      boardIdBySlug[row.slug] = row.board_id;
    });

    if (!boardIdBySlug.general || !boardIdBySlug.announcement || !boardIdBySlug.useronly || !boardIdBySlug.qna) {
      throw new Error("Missing seeded boards");
    }

    const userRows = await queryInterface.sequelize.query(
      "SELECT user_id FROM users WHERE user_role = 'user' ORDER BY user_id",
      { type: QueryTypes.SELECT }
    );

    const userIds = userRows.map((row) => row.user_id);
    if (userIds.length === 0) {
      throw new Error("Missing seeded users");
    }

    const adminRows = await queryInterface.sequelize.query(
      "SELECT user_id FROM users WHERE username = 'admin' LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    const adminUserId = adminRows[0]?.user_id;
    if (!adminUserId) {
      throw new Error("Missing admin user");
    }

    const pick = (list) => list[Math.floor(rng() * list.length)];

    const titleTopics = [
      "Build",
      "Release",
      "UI",
      "Backend",
      "Deploy",
      "Docs",
      "API",
      "Security",
      "Performance",
      "Cleanup",
      "Refactor",
      "Design",
      "Testing",
      "Migration",
      "Analytics",
      "Search",
      "Upload",
      "Auth",
      "Session",
      "Board",
    ];

    const titleActions = [
      "update",
      "note",
      "check",
      "plan",
      "status",
      "review",
      "summary",
      "idea",
      "draft",
      "fix",
      "follow-up",
      "report",
      "proposal",
    ];

    const titleQualifiers = [
      "for this week",
      "for next sprint",
      "after deploy",
      "before lunch",
      "from yesterday",
      "quick wins",
      "v2",
      "phase 1",
      "phase 2",
      "next steps",
      "open questions",
      "for QA",
      "for staging",
      "for prod",
      "rollout",
    ];

    const leadLines = [
      "Quick update from today.",
      "Leaving a short note for context.",
      "Sharing a brief status before I forget.",
      "Small update after a focused session.",
      "A short note to keep everyone aligned.",
      "Posting this while the details are fresh.",
      "Captured a few observations from testing.",
      "Quick follow-up from the latest run.",
    ];

    const detailLines = [
      "The latest build feels stable on my end.",
      "The new flow is clearer, but I found a small edge case.",
      "Login latency improved after a tiny tweak.",
      "I trimmed a few warnings and cleaned up the logs.",
      "The UI spacing looks better on mobile now.",
      "We might need a follow-up on error handling.",
      "The board list loads faster with the new query.",
      "I checked the migrations and they look consistent.",
      "Uploads work, but we should verify the limits.",
      "Session expiry behaves as expected so far.",
    ];

    const actionLines = [
      "I will send a follow-up once tests finish.",
      "Please flag anything that looks off.",
      "I will keep an eye on logs tomorrow.",
      "Let me know if you want a deeper dive.",
      "I will clean up the remaining TODOs next.",
      "I can adjust the copy if needed.",
      "Ping me if you see regressions.",
    ];

    const announcementLines = [
      "Please read and share with the team.",
      "This takes effect after the next deploy window.",
      "Reply in thread if there are concerns.",
      "Expect a short downtime window if needed.",
      "We will post a follow-up once it lands.",
      "Thanks for reviewing this in advance.",
    ];

    const imagePaths = [
      "/uploads/posts/images/post-image-1768056768690-5df566ddcf0c6175.webp",
    ];

    const filePaths = [];

    const buildTitle = (boardSlug, displayId) => {
      const base = `${pick(titleTopics)} ${pick(titleActions)} ${pick(
        titleQualifiers
      )}`;
      const suffix = rng() < 0.3 ? ` #${displayId}` : "";
      if (boardSlug === "announcement") {
        return `Announcement: ${base}${suffix}`;
      }
      return `${base}${suffix}`;
    };

    const buildContent = (boardSlug, hasImage, hasFile) => {
      const parts = [pick(leadLines), pick(detailLines)];
      if (rng() < 0.6) {
        parts.push(pick(detailLines));
      }
      if (hasImage) {
        parts.push("Screenshot attached for context.");
      }
      if (hasFile) {
        parts.push("Attachment included for reference.");
      }
      if (boardSlug === "announcement") {
        parts.push(pick(announcementLines));
      } else {
        parts.push(pick(actionLines));
      }
      return parts.join(" ");
    };

    let postIndex = 0;
    const basePostDate = new Date(Date.UTC(2026, 0, 1, 9, 0, 0));

    const nextPostDate = () => {
      const date = new Date(basePostDate.getTime() + postIndex * 60 * 60 * 1000);
      postIndex += 1;
      return date;
    };

    const buildPost = (boardSlug, displayId) => {
      const hasImage = imagePaths.length > 0 && rng() < 0.22;
      const hasFile = filePaths.length > 0 && rng() < 0.08;
      const createdAt = nextPostDate();
      const authorId =
        boardSlug === "announcement"
          ? adminUserId
          : boardSlug === "useronly" || boardSlug === "qna"
            ? pick([...userIds, adminUserId])
            : pick(userIds);
      return {
        board_id: boardIdBySlug[boardSlug],
        display_id: displayId,
        user_id: authorId,
        title: buildTitle(boardSlug, displayId),
        content: buildContent(boardSlug, hasImage, hasFile),
        image_url: hasImage ? pick(imagePaths) : null,
        file_url: hasFile ? pick(filePaths) : null,
        created_at: createdAt,
        updated_at: createdAt,
        use_yn: true,
      };
    };

    const seedBoardPostsUpTo = async (boardSlug, targetCount) => {
      const boardId = boardIdBySlug[boardSlug];
      if (!boardId) {
        throw new Error(`Missing board id for ${boardSlug}`);
      }

      const countRows = await queryInterface.sequelize.query(
        `
        SELECT COUNT(*) AS total_count
        FROM posts
        WHERE board_id = :boardId
          AND use_yn = true
        `,
        {
          replacements: { boardId },
          type: QueryTypes.SELECT,
        }
      );
      const existingCount = Number(countRows[0]?.total_count ?? 0);
      if (existingCount >= targetCount) {
        return;
      }

      const maxRows = await queryInterface.sequelize.query(
        `
        SELECT COALESCE(MAX(display_id), 0) AS max_display_id
        FROM posts
        WHERE board_id = :boardId
        `,
        {
          replacements: { boardId },
          type: QueryTypes.SELECT,
        }
      );

      const maxDisplayId = Number(maxRows[0]?.max_display_id ?? 0);
      const posts = [];
      const missingCount = targetCount - existingCount;

      for (let i = 1; i <= missingCount; i += 1) {
        posts.push(buildPost(boardSlug, maxDisplayId + i));
      }

      if (posts.length > 0) {
        await queryInterface.bulkInsert("posts", posts);
      }
    };

    await seedBoardPostsUpTo("general", 329);
    await seedBoardPostsUpTo("announcement", 31);
    await seedBoardPostsUpTo("useronly", crypto.randomInt(20, 31));
    await seedBoardPostsUpTo("qna", crypto.randomInt(20, 31));

    const counters = [
      { board_id: boardIdBySlug.general },
      { board_id: boardIdBySlug.announcement },
      { board_id: boardIdBySlug.useronly },
      { board_id: boardIdBySlug.qna },
    ];

    for (const counter of counters) {
      const maxRows = await queryInterface.sequelize.query(
        `
        SELECT COALESCE(MAX(display_id), 0) AS max_display_id
        FROM posts
        WHERE board_id = :board_id
        `,
        {
          replacements: { board_id: counter.board_id },
          type: QueryTypes.SELECT,
        }
      );
      const nextDisplayId = Number(maxRows[0]?.max_display_id ?? 0) + 1;
      await queryInterface.sequelize.query(
        `
        INSERT INTO board_post_counters (board_id, next_display_id)
        VALUES (:board_id, :next_display_id)
        ON CONFLICT (board_id) DO UPDATE
        SET next_display_id = EXCLUDED.next_display_id
        `,
        { replacements: { board_id: counter.board_id, next_display_id: nextDisplayId } }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const { QueryTypes, Op } = Sequelize;
    const slugs = ["general", "announcement", "useronly", "qna"];
    const usernames = [
      "admin",
      "pentest",
      "adrian",
      "alice",
      "allen",
      "amber",
      "bruno",
      "carson",
      "diana",
      "elena",
      "felix",
      "grace",
      "hansel",
      "irene",
      "jared",
      "karen",
      "kevin",
      "louis",
      "mason",
      "nolan",
      "oliver",
      "peter",
      "quinn",
      "rachel",
      "samuel",
      "taylor",
      "ursula",
      "victor",
      "warren",
      "xavier",
      "yvette",
      "zack",
    ];

    const boardRows = await queryInterface.sequelize.query(
      "SELECT board_id FROM boards WHERE slug IN (:slugs)",
      { replacements: { slugs }, type: QueryTypes.SELECT }
    );

    if (boardRows.length > 0) {
      const boardIds = boardRows.map((row) => row.board_id);
      await queryInterface.bulkDelete("posts", {
        board_id: { [Op.in]: boardIds },
      });
      await queryInterface.bulkDelete("board_post_counters", {
        board_id: { [Op.in]: boardIds },
      });
    }

    await queryInterface.bulkDelete("boards", { slug: { [Op.in]: slugs } });
    await queryInterface.bulkDelete("users", {
      username: { [Op.in]: usernames },
    });
  },
};
