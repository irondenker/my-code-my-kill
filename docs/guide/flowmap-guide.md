# Flowmap 생성/운영 가이드

이 문서는 `docs/flowmap` 산출물을 어떻게 생성/검증/리뷰할지 정리합니다.

## 1) Flowmap이 하는 일

`flowmap`은 서버 엔드포인트별 요청 흐름을 아래 순서로 시각화/정리합니다.

- `Entry`
- `Middleware` (글로벌 + 라우트 레벨)
- `Handler`
- `Sink / Exit`
- `Session key read/write`

자동 생성기는 `server/src/scripts/generate-flowmap.ts`입니다.

## 2) 기본 명령

`flowmap` 스크립트는 `server` 디렉토리 기준으로 실행합니다.

```bash
cd server
npm run flowmap:gen
```

- `docs/flowmap` 전체를 재생성합니다.
- 스크립트가 관리하지 않는 파일/폴더(`README 2.md`, `flows 2` 같은 충돌 복사본 포함)는 정리됩니다.

검증(드리프트 체크):

```bash
cd server
npm run flowmap:check
```

- 내부적으로 `flowmap:gen` 실행 후, `docs/flowmap` 변경/미추적 파일이 있으면 실패합니다.
- CI(`.github/workflows/server-ci.yml`)에서 `Check Flowmap drift` 단계로 동일 검증을 수행합니다.
- 로컬 `pre-push` 훅에서도 `npm run flowmap:check`가 자동 실행됩니다.

## 3) 권장 작업 순서

라우트/컨트롤러/미들웨어를 수정한 뒤 아래 순서를 권장합니다.

```bash
cd server
npm run flowmap:gen
cd ..
git diff -- docs/flowmap
```

리뷰 포인트:

- 새 엔드포인트가 `docs/flowmap/README.md`와 `docs/flowmap/catalog.json`에 반영되었는지
- 해당 엔드포인트의 `flows/*.mmd`, `flows/*.json`이 의도한 sink/exit/session access를 보여주는지
- 불필요한 노이즈 변경(정렬/이름 충돌 파일)이 없는지

## 4) 산출물 구조

`docs/flowmap` 주요 파일:

- `README.md`: 라우트 파일별 엔드포인트 인덱스(자동 생성)
- `catalog.json`: 도메인/엔드포인트/세션키 요약
- `global-middlewares.mmd`: 글로벌 미들웨어 흐름
- `session-access.mmd`: 세션 키 접근 흐름 요약 다이어그램
- `session-access.json`: 세션 키별 read/write 엔드포인트 집계
- `flows/<ENDPOINT_ID>.mmd`: 엔드포인트별 Mermaid flowchart
- `flows/<ENDPOINT_ID>.json`: 엔드포인트별 구조화 메타데이터

## 5) 자주 헷갈리는 포인트

- `docs/flowmap` 내부 파일은 수동 편집 대상이 아닙니다. 다음 생성 때 덮어써집니다.
- 생성 로직 자체를 바꾸려면 `server/src/scripts/generate-flowmap.ts`를 수정합니다.
- 루트에서 바로 `npm run flowmap:gen`을 실행하면 실패합니다. 반드시 `server`에서 실행하세요.
