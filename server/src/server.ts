import 'dotenv/config';
import { createApp } from './app.js';
import { assertDbConnection } from './db/assert.js';
import { closeDb } from './db/close.js';

const PORT = Number(process.env.PORT ?? 3000);

async function bootstrap() {
  // ✅ DB 먼저
  await assertDbConnection();
  console.log('✅ DB 연결 성공');

  // ✅ 그 다음 서버 시작
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  // 3️⃣ 종료 시그널 핸들링(정의)
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received. Shutting down...`);

    server.close(async () => {
      try {
        await closeDb(); // ✅ 여기서 사용
        console.log('✅ DB 연결 정상 종료');
        process.exit(0);
      } catch (err) {
        console.error('❌ 종료 중 오류:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('❌ 부팅 실패:', err);
  process.exit(1);
});
