# Seed Assets 준비 가이드

Seeder 실행 전에 raw 더미 에셋을 먼저 준비합니다.

## 실행 순서

```bash
cd server
npm run assets:fetch
npm run assets:avatars
npm run assets:files
npm run seed
```

1. `assets:fetch`
   - Lorem Picsum 이미지를 대량 다운로드해 `seed-assets/raw/post-images/`에 저장
   - `seed-assets/manifest/post-images.json` 생성
2. `assets:avatars`
   - 네트워크 없이 생성형 webp 아바타를 `seed-assets/raw/avatars/`에 생성
   - `seed-assets/manifest/avatars.json` 생성
3. `assets:files`
   - 코드의 첨부 확장자 whitelist를 읽어 허용 확장자만 `seed-assets/raw/files/`에 생성
   - `seed-assets/manifest/files.json` 생성
4. `seed`
   - 로컬 raw 에셋을 업로드 파이프라인 래퍼로 저장하고 DB에 반영
   - 유저 62명, 게시글 1124개, 감사로그(기본 45,000건) 생성
   - 실행 시 `users/boards/posts/board_post_counters/audit_logs`를 reset 후 다시 채움

## Seed 옵션 (PowerShell)

```powershell
# seed 랜덤성 고정
$env:SEED_TEXT="my-seed-v1"; npm run seed

# audit 로그 건수(40,000~60,000)
$env:SEED_AUDIT_COUNT="50000"; npm run seed
```

## Seed 옵션 (Bash)

```bash
# seed 랜덤성 고정
SEED_TEXT="my-seed-v1" npm run seed

# audit 로그 건수(40,000~60,000)
SEED_AUDIT_COUNT="50000" npm run seed
```

## 주의 사항

- 위 스크립트는 seed 실행과 분리되어야 합니다.
- seed 실행 중 외부 URL 다운로드를 호출하지 않습니다.
- raw 에셋 바이너리는 대용량이 될 수 있으므로 Git에는 기본적으로 추적하지 않습니다.
