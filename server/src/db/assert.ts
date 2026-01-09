import { sequelize } from "./index.ts";

// assert- 부팅 시 DB 연결 체크
export async function assertDbConnection(): Promise<void> {
  await sequelize.authenticate();
}
