# 업로드 검증 가이드(확장자 + 매직넘버 + 텍스트성 휴리스틱)

이 프로젝트는 `multer.memoryStorage()`로 업로드를 받은 뒤 검증하고 `public/uploads/...` 아래에 저장합니다.
이 조합은 구현이 편하지만, 업로드 보안 취약점이 가장 자주 생기는 패턴이기도 합니다.

이 문서는 아래를 설명합니다.

1. 무엇을 검증하는지
2. 토글 2개가 각각 무엇을 의미하는지
3. 같이 막아야 하는 추가 방어(그리고 그 이유)

## 왜 업로드 검증이 필요한가

`file.originalname`(파일명)과 `file.mimetype`(클라이언트가 주장하는 타입)만 믿으면 공격자는 쉽게 우회할 수 있습니다.

- `evil.exe`를 `report.txt`로 바꿔 업로드 (확장자 스푸핑)
- 바이너리 파일을 보내면서 `Content-Type: text/plain`이라고 주장 (MIME 스푸핑)
- `.txt`로 위장한 HTML/JS를 올리고, `/public`에서 서빙될 때 브라우저가 렌더링하게 유도 (콘텐츠 스니핑/인라인 렌더링)

여기서 목표는 "완벽한 파일 타입 판별"이 아닙니다(그건 파일 포맷 파싱, AV 스캔, 샌드박싱 등이 필요).
대신, 코드 복잡도를 크게 올리지 않으면서도 흔한 우회/변조를 최대한 싸게 차단하는 것이 목표입니다.

## 업로드가 처리되는 위치

- 게시판(이미지 + 첨부파일)
  - `server/src/routes/board.routes.ts` (multer)
  - `server/src/controllers/board.controller.ts` (`storePostImage`, `storePostAttachment`)
- 아바타
  - `server/src/routes/user.routes.ts` (multer)
  - `server/src/controllers/avatar.controller.ts`

## 토글 2개

토글은 `server/src/config/lab-options.ts`가 `lab-options.json`에서 로드합니다.
이 옵션 파일은 프로세스 시작 시 1회 로드되므로, 값을 바꿨다면 서버를 재시작해야 반영됩니다.

```json
{
  "uploadValidation": {
    "extensionCheckEnabled": true,
    "magicNumberCheckEnabled": true
  }
}
```

- 옵션 파일 위치
  - 기본 경로는 `path.join(process.cwd(), "lab-options.json")`입니다.
  - 일반적인 실행 방식(`npm -C server ...`)에서는 `server/lab-options.json`을 의미합니다.

- `extensionCheckEnabled`
  - `true`: 첨부파일 확장자는 허용 목록(예: `.pdf`, `.txt`, `.csv`, `.zip`) 안에 있어야 합니다.
  - `false`: 확장자 allowlist 검사를 건너뜁니다(랩/실험용). 다만 MIME/매직넘버가 켜져 있으면 콘텐츠는 여전히 거절될 수 있습니다.

- `magicNumberCheckEnabled`
  - `true`: 실제 업로드된 바이트(`file.buffer`)를 보고 "겉으로 주장한 타입"과 "실제 내용"이 맞는지 검사합니다.
  - `false`: MIME/확장자 같은 "약한" 신호만 남습니다.

기본값은 둘 다 `true`입니다.

## 매직넘버 검사(바이너리 포맷)

대표적인 바이너리 포맷은 파일 앞부분에 시그니처(매직 바이트)가 있습니다.

- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47 0D 0A 1A 0A`
- WebP: `"RIFF" .... "WEBP"`
- PDF: `"%PDF-"`
- ZIP: `"PK" ...`

`magicNumberCheckEnabled = true`일 때, 기대 타입과 시그니처가 맞지 않으면 업로드를 초기에 거절합니다.

관련 코드:

- `server/src/utils/file-signature.util.ts`
- `server/src/utils/upload-validation.util.ts`

## `.txt` / `.csv`의 매직넘버(텍스트성 검증)

`txt`/`csv`는 PDF처럼 고정된 시그니처가 없습니다.
그래서 이 프로젝트에서는 `txt`/`csv`에 대해 "매직넘버" 토글을 아래의 "텍스트성 검증(바이너리 차단)"으로 구현했습니다.

- NUL 바이트(`0x00`)가 있으면 거절 (바이너리 신호로 강함)
- PDF/ZIP/이미지 시그니처로 시작하면 거절 (텍스트로 위장한 바이너리 차단)
- UTF-8 strict 디코딩이 가능해야 함 (invalid byte를 대체하는 모드가 아니라, 실패해야 함)
- 디코딩된 문자열에서 수상한 제어문자가 비정상적으로 많으면 거절
  - `\\r`, `\\n`, `\\t`만 허용하고 나머지 제어문자는 비율로 제한

이 방식은 "바이너리를 .txt로 바꿔 업로드" 같은 가장 흔한 변조를 꽤 잘 잡아냅니다.

트레이드오프:

- UTF-8이 아닌 정상 텍스트(예: 다른 인코딩)는 거절될 수 있습니다.
- CSV를 완전 파싱하는 게 아니라, "텍스트로 보이는지"만 검사합니다.

## 같이 막아야 하는 것: 정적 서빙 헤더

업로드는 `public/` 아래에 저장되고 `express.static(...)`으로 서빙됩니다.
브라우저는 때때로 콘텐츠 타입을 "추측(sniff)"하거나 파일을 인라인으로 렌더링하려고 합니다.

그래서 아래 방어를 추가했습니다.

- `X-Content-Type-Options: nosniff`
  - 브라우저가 Content-Type을 추측하지 말라는 신호
- `/uploads/posts/files/*`는 `Content-Disposition: attachment`
  - 첨부파일(PDF/ZIP/TXT/CSV 등)을 "렌더링"이 아니라 "다운로드"로 강제

관련 코드:

- `server/src/app.ts`

이게 중요한 이유:

- 텍스트 파일은 HTML/JS를 포함할 수 있습니다.
- 설령 검증을 잘해도, 인라인 렌더링은 사용자 영향 범위를 키웁니다.

## 이 방어가 해결하지 못하는 것

- 헤더가 정상인 악성 PDF/ZIP(포맷 내부 취약점/페이로드)
- 폴리글랏(여러 포맷으로 해석 가능한 파일)
- AV 스캔/샌드박싱이 필요한 케이스

그 단계까지 필요하면 AV/샌드박스 파이프라인을 붙이고, 업로드 파일을 앱과 같은 오리진에서 직접 서빙하지 않는 구조를 고려하세요.
