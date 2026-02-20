# Express에서 Helmet 없이 CSP 직접 구현하기 (Nonce 방식)

## `Nonce`는 왜 사용해야 하는가?

### 개요

- `SSR` 환경에서는 인라인 스크립트가 섞이기 쉽다.
- `unsafe-inline`을 켜면 XSS 방어력이 크게 떨어진다.
- `Nonce`를 쓰면 **해당 요청에서 서버가 승인한 인라인 스크립트만** 실행 가능해진다.

### 핵심 원리

- 서버가 요청마다 랜덤 `nonce`생성
- CSP에 `script-src 'nonce-<nonce>'`를 넣고
- HTML의 `<script nonce="<nonce>">`에 같은 `nonce`를 붙인다
- 공격자가 임의로 삽입한 `<script>`는 `nonce`가 없으므로 실행 불가

### Express CSP 미들웨어 예시

```ts
import type { RequestHandler } from "express";
import crypto from "node:crypto";

export function createCspMiddleware(params?: { reportOnly?: boolean }): RequestHandler {
  const reportOnly = params?.reportOnly ?? false;

  return (req, res, next) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.cspNonce = nonce;

    const csp = [
      `default-src 'self'`,
      `base-uri 'self'`,
      `object-src 'none'`,
      `frame-ancestors 'none'`,
      `form-action 'self'`,
      `img-src 'self' data: blob:`,
      `font-src 'self' data:`,
      `style-src 'self' 'unsafe-inline'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `connect-src 'self'`,
    ].join("; ");

    res.setHeader(reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", csp);
    next();
  };
}
```

### 권장 위치(app.ts) 기준

- `const app = express();` 직후
- 라우트 등록 전에 삽입

예시:

```ts
const app = express();
app.disable("x-powered-by");

app.use(createCspMiddleware({ reportOnly: true })); // 개발 중엔 true로 시작 추천
```

### EJS에서 nonce 적용하기

1. 인라인 스크립트가 있으면 반드시 `nonce`를 붙인다

    ```ejs
    <script nonce="<%= cspNonce %>">
    (function(){ /* ... */ })();
    </script>
    ```

2. 외부 스크립트는 보통 `nonce` 불필요하다

    `script-src 'self'`면 `/assets/js/app.js` 같은 자체 호스팅 리소스는 허용된다.

    ```ejs
    <script src="/assets/js/app.js" defer></script>
    ```

3. 외부 CDN을 쓰면, 해당 도메인을 `script-src` allowlist에 추가해야 한다.

## 자주 겪는 문제와 해결 방법

### 버튼/모달 미작동

- Bootstrap JS가 막힌 게 아니라 보통 인라인 스크립트나 외부 리소스가 차단된 경우
- Report-Only 로그 확인 후 `script-src` allowlist/nonce 적용

### CSS 깨짐

- `style-src`에서 인라인 스타일이 차단됐을 가능성
- 개발 단계에서는 `style-src 'self' 'unsafe-inline'`로 시작하고 점진 강화

### 이미지 안 뜸

- `img-src`에 `data:`/`blob:`가 필요한 경우가 많다
- 업로드 미리보기, 캔버스, base64 이미지 등에서 흔하다.
