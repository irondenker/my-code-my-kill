import { Sequelize } from "sequelize";
import { dbEnv } from "./env.js";

// ✅ SQL 로그
const logging = process.env.DB_LOGGING === "true" ? (msg: string) => console.log("[SQL]", msg) : false;

export const sequelize = new Sequelize(
    dbEnv.name,
    dbEnv.user,
    dbEnv.password, {
    host: dbEnv.host,
    port: dbEnv.port,
    dialect: "postgres",
    logging,
    pool: {
        max: 10,
        min: 0,
        acquire: 30_000,
        idle: 10_000,
    },
    // ✅ 쿼리 실행 시간(ms) 같이 찍기
    benchmark: true,
});
