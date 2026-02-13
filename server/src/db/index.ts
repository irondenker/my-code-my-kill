import { Sequelize } from "sequelize";
import { dbEnv } from "./env.js";

/**
 * Sequelize 원본 SQL을 로그용 한 줄 문자열로 압축합니다.
 *
 * @param sql Sequelize가 전달한 원본 SQL
 * @returns 공백/개행이 한 칸으로 정리된 SQL 문자열
 */
const compactSqlForLog = (sql: string): string => sql.replace(/\s+/g, " ").trim();

/**
 * 공용 DB 클라이언트용 Sequelize 로깅 옵션입니다.
 *
 * 동작:
 * - `dbEnv.logging === false`: SQL 로그 비활성화
 * - `dbEnv.logging === true`: SQL 한 줄 로그 활성화
 * - `benchmark: true`일 때 실행 시간(ms)을 같은 라인에 추가 출력
 *
 * @param sql Sequelize가 전달한 원본 SQL
 * @param timing benchmark 활성화 시 전달되는 실행 시간(ms)
 */
const logging: false | ((sql: string, timing?: number) => void) = dbEnv.logging
    ? (sql: string, timing?: number) => {
        const now = new Date();
        const compactSql = compactSqlForLog(sql);

        if (typeof timing === "number") {
            console.log(`[SQL][${now}]`, `${compactSql} (${timing} ms)`);
            return;
        }

        console.log(`[SQL][${now}]`, compactSql);
    }
    : false;

export const sequelize = new Sequelize(
    dbEnv.name,
    dbEnv.user,
    dbEnv.password,
    {
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
        benchmark: true,
    },
);
