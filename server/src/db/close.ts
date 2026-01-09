import { sequelize } from "./index.ts";

// close - 종료 시 DB 커넥션 정리
export async function closeDb(): Promise<void> {
  await sequelize.close();
}