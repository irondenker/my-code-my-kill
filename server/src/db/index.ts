import { Sequelize } from "sequelize";
import { dbEnv } from "./env.ts";

const logging = process.env.DB_LOGGING === "true" ? console.log : false;

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
});
