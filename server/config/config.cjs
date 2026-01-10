require("dotenv/config");

const testDatabase =
  process.env.DB_NAME_TEST ??
  (process.env.DB_NAME ? `${process.env.DB_NAME}_test` : undefined);

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    dialect: "postgres",
    logging: process.env.DB_LOGGING === "true",
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: testDatabase,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    dialect: "postgres",
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    dialect: "postgres",
    logging: false,
  },
};
