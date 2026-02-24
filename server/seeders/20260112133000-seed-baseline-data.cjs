'use strict';

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SERVER_ROOT = path.resolve(__dirname, "..");
const REALISTIC_SEED_SCRIPT = path.join(SERVER_ROOT, "src", "scripts", "seed-realistic-data.ts");
const UPLOAD_DIRS = [
  path.join(SERVER_ROOT, "public", "uploads", "avatars"),
  path.join(SERVER_ROOT, "public", "uploads", "posts", "images"),
  path.join(SERVER_ROOT, "public", "uploads", "posts", "files"),
];

function runRealisticSeedScript() {
  const args = ["--import", "tsx", REALISTIC_SEED_SCRIPT];

  if (process.env.SEED_TEXT) {
    args.push(`--seed=${process.env.SEED_TEXT}`);
  }
  if (process.env.SEED_AUDIT_COUNT) {
    args.push(`--audit-count=${process.env.SEED_AUDIT_COUNT}`);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: SERVER_ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`realistic seed script failed with exit code ${String(result.status)}`);
  }
}

async function clearGeneratedUploadFiles() {
  await Promise.all(
    UPLOAD_DIRS.map(async (dirPath) => {
      await fs.mkdir(dirPath, { recursive: true });
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      await Promise.all(
        entries
          .filter((entry) => entry.name !== ".gitkeep")
          .map((entry) => fs.rm(path.join(dirPath, entry.name), { recursive: true, force: true }))
      );
    })
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    runRealisticSeedScript();
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      TRUNCATE TABLE
        audit_logs,
        posts,
        board_post_counters,
        boards,
        users
      RESTART IDENTITY CASCADE
    `);

    await clearGeneratedUploadFiles();
  },
};
