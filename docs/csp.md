# CSP 학습 노트

> 목적: “CSP를 왜/어떻게 적용하는지”를 이해한다.

---

## CSP란 무엇인가

CSP(Content Security Policy)는 브라우저에게 “이 페이지에서 어떤 리소스(스크립트/스타일/이미지/프레임 등)를 어디서 로드/실행해도 되는지”를 선언하는 **클라이언트 측 보안 정책**이다.

핵심 효과:

- XSS 성공 후에도 **스크립트 실행/로드를 제한**해 피해를 크게 줄인다.
- 외부 리소스 로드(광고/분석/위젯)를 **명시적으로 통제**한다.
- clickjacking(프레임 삽입) 방지 정책을 CSP로도 강제할 수 있다(`frame-ancestors`).

CSP는 “완벽한 XSS 방지”가 아니라:

- **XSS를 ‘막는’ 레이어**이자
- 사고 시 피해를 줄이는 **피해 완화(mitigation)** 장치다.

---

## CSP 기본 개념: Directive와 Source List

CSP 헤더는 `directive;` `directive; ...` 형태로 구성된다.

예:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc...'
```

### `default-src`

> 모든 리소스 유형에 대한 기본 정책

- 지정하지 않은 타입들은 `default-src`를 따라간다.
- 일반적으로 `default-src 'self'`로 시작하는 경우가 많다.

### `script-src`

> JS 실행/로드 정책

- XSS와 가장 밀접한 directive
- 일반적인 목표: **`unsafe-inline` 없이** 스크립트 허용

### `style-src`

> CSS 정책

- 부트스트랩/템플릿에서 인라인 style이 있으면 깨질 수 있다.
- 강화는 가능하지만 보통 단계적으로 한다 (`Report-Only`로 먼저 확인).

### `img-src`, `font-src`, `connect-src`

> 이미지, 폰트, fetch/websocket 대상 제어

- `img-src`는 `data:`(base64)나 `blob:` 필요 여부가 자주 이슈

### CSP 첫 설정 스타터팩

- `object-src 'none'` : 플러그인(Flash 등) 차단
- `base-uri 'self'` : `<base href>` 악용 방지
- `frame-ancestors 'none'` : 외부 사이트가 내 페이지를 `iframe`에 넣는 것 차단(clickjacking 대응)
- `form-action 'self'` : 폼 전송 대상 제한(피싱/데이터 유출 완화)

---

## CSP 헤더 모드

### 차단 모드(`Enforce`)

``` http
Content-Security-Policy: ...
```

- 위반 발생 시 브라우저가 **실제로 차단**한다.
- 인라인 스크립트가 정책에 위반되면 **실행 자체가 막힌다.**

### 감시 모드(`Report-Only`)

> `Report-Only`는 보안 강화 기능이 아니다.
> “정책이 깨지는지 확인하는 **실험 모드**”에 불과하다.

``` http
Content-Security-Policy-Report-Only: ...
```

- 위반 발생 시 **막지 않는다.**
- 대신 콘솔에 **위반 로그**가 남는다.
- 별도 설정 시 위반 로그를 리포트로 구성하여, 서버로 전송이 가능하다.
- 운영 영향 없이, 정책을 **시험 운용** 할 수 있다.

**팁: MCMK 적용 플로우 (`Report-Only` 활용):**

1. `Report-Only` 배포
2. 깨지는 리소스/위반 수집
3. `allowlist` / `nonce` 적용으로 정책 다듬기
4. `Enforce`로 전환

---

## CSP가 막을 수 없는 것

중요: CSP는 **웹 샌드박스** 맥락에서 유효한 **브라우저 정책**이다.

### CSP 정책 설정의 허점

> **CSP 정책 설정 자체에 허점**이 생기면 공격은 정상 동작한다.

예를 들어:

- `connect-src`가 외부 도메인을 허용한 경우
- `script-src`에 `unsafe-inline`을 허용한 경우

### '신뢰하는' 스크립트 내부의 `DOM` 조작

> CSP는 **신뢰하는** 스크립트에서 발생하는 취약점을 막지 못한다.

예를 들어 신뢰하는 스크립트 내부에 이런 코드가 있는 경우:

```js
element.innerHTML = userInput;
```

### XSS 취약점의 '존재' 자체

> CSP는 XSS 실행을 차단할 수는 있지만, **취약점 자체를 제거하지는 않는다.**

취약점은 여전히 존재하며, CSP가 없는 환경에서는 여전히 재발 가능하다.

### 브라우저 확장 프로그램/단말 침해

> CSP는 **브라우저 전반의 보안**과 **단말 보안(Endpoint Security)** 을 책임지지 않는다.

**악성 확장 프로그램**이나 **이미 감염된 단말 환경**에서는 CSP를 우회할 수 있다.

### 서버 측 취약점

> CSP는 **서버 내부 로직에는 영향을 주지 못한다.**

- SQL Injection
- Command Injection
- SSRF
- 인증/인가 우회
- 비즈니스 로직 취약점

### 클라이언트 로직 기반 권한 상승

> 권한 검증은 반드시 **서버에서 수행되어야 한다.**

클라이언트 JS 로직이 잘못 설계된 경우:

```js
if (isAdmin) { showAdminPanel(); }
```

## 결론

CSP는 **웹 샌드박스** 내에서만 유효한 설정이다.

따라서 CSP의 책임 범위를 벗어나는 아래의 상황에서는 **방어가 불가능하다:**

- 악성 브라우저 확장 프로그램으로 **CSP 설정 자체를 우회**하는 경우
- 사용자의 단말이 악성코드에 감염된 경우
