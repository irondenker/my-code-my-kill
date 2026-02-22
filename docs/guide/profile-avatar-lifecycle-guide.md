# Profile / Avatar 라이프사이클 가이드

이 문서는 프로필 조회/수정과 아바타 업로드/삭제의 전체 흐름을 운영 관점에서 정리합니다.

## 연관 코드

- 라우트: `server/src/routes/user.routes.ts`
- 프로필 컨트롤러: `server/src/controllers/user.controller.ts`
- 아바타 컨트롤러: `server/src/controllers/avatar.controller.ts`
- 프로필 서비스 facade: `server/src/services/profile/profile-management.service.ts`
- 업로드 상수: `server/src/constants/upload-avatar.constants.ts`
- CSRF multipart 처리: `server/src/middlewares/csrf.middleware.ts`

## 라우트 요약

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/@:username` | 공개 | 사용자 프로필 조회 |
| `GET` | `/setting/profile` | 로그인 | 프로필 수정 폼 |
| `GET` | `/settings/profile` | 로그인 | 프로필 수정 폼(별칭) |
| `POST` | `/setting/profile` | 로그인 | 프로필 수정 |
| `POST` | `/settings/profile` | 로그인 | 프로필 수정(별칭) |
| `POST` | `/users/avatar` | 로그인 | 아바타 업로드 |
| `POST` | `/users/avatar/delete` | 로그인 | 아바타 삭제 |

## 프로필 조회/수정 흐름

- 공개 프로필은 `username/displayName/bio/profileImageUrl`을 노출합니다.
- `email/phoneNumber`는 본인 또는 admin만 볼 수 있습니다.
- 수정은 본인 계정만 가능하며 입력 검증을 수행합니다.
  - `displayName <= 50`
  - `email` 형식
  - `phoneNumber` 형식 + 길이 제한(<=30)
  - `bio <= 500`

## 아바타 업로드 흐름

업로드 처리 순서:

1. 로그인 확인
2. 파일 존재 확인
3. (옵션) 매직넘버 검사
4. (옵션) MIME 검사
5. 파일 크기 검사
6. 이미지 메타데이터 검사(최소/최대 해상도)
7. `webp` 변환 후 `public/uploads/avatars` 저장
8. DB `profileImageUrl` 업데이트 + 세션 동기화
9. 이전 파일 best-effort 삭제

핵심 제한값:

- 최대 용량: `5MB`
- 입력 최대 해상도: `2048x2048`
- 입력 최소 해상도: `128x128`
- 저장 포맷/크기: `webp`, `512x512`, quality `80`

## 아바타 삭제 흐름

1. 로그인 확인
2. DB `profileImageUrl`을 `null`로 업데이트
3. 세션 `profileImageUrl` 동기화
4. 이전 파일 best-effort 삭제

## 저장소/배포 관점

- 저장 경로: `server/public/uploads/avatars`
- dev compose: `./server:/app` 바인드 마운트로 호스트 파일이 그대로 반영
- prod compose: `public_uploads` volume을 `/app/public/uploads`와 nginx에 공유

즉, prod에서는 컨테이너 재기동 후에도 volume이 유지되면 업로드 파일이 남습니다.

## CSRF와 multipart 주의

- `POST /users/avatar`는 multipart 요청이므로 전역에서 `multer -> csurf` 순서를 강제합니다.
- `csrf` lab 모드가 켜져도 multipart pre-parser는 유지됩니다.
