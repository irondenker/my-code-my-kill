# `nosniff`와 MIME 스니핑 방어

`X-Content-Type-Options: nosniff`의 보호 범위, 한계, 위변조 시나리오를 정리한 문서입니다.

## MIME 타입이란?

MIME 타입은 서버가 응답 본문이 어떤 형식인지 브라우저에 알려주는 값입니다.  
HTTP 응답의 `Content-Type` 헤더로 전달됩니다.

예시:

- `Content-Type: text/html` -> HTML 문서
- `Content-Type: text/css` -> CSS 스타일시트
- `Content-Type: application/javascript` -> JavaScript 파일
- `Content-Type: image/png` -> PNG 이미지

브라우저는 이 값을 기준으로 "렌더링할지, 실행할지, 다운로드할지"를 결정합니다.  
`nosniff`가 없으면 일부 상황에서 이 값을 무시하고 내용을 추측(MIME sniffing)해 해석할 수 있습니다.

## 용어 빠른 정리

- MIME sniffing(스니핑): 브라우저가 `Content-Type` 선언을 그대로 따르지 않고, 응답 본문을 보고 타입을 추측하는 동작
- 오리진(origin): `scheme + host + port` 조합. 세 값이 모두 같아야 같은 오리진입니다.
- MITM(중간자 공격): 클라이언트와 서버 사이에서 응답 헤더/본문을 가로채 바꾸는 공격
- CDN/프록시/캐시 계층: 원본 서버 앞뒤에서 응답을 중계/저장하는 구간(예: CDN 지역 캐시 서버, 리버스 프록시 캐시, 사내 프록시 캐시)
- CDN 엣지 캐시(edge cache): 사용자와 가까운 CDN 지역 서버에 임시 저장된 캐시 응답
  예시: 원본 서버가 서울에 있어도, 부산 사용자는 부산 CDN 캐시 서버에서 `app.js`를 먼저 받게 됩니다.
- 캐시 오염(cache poisoning): 정상 응답 대신 잘못되거나 변조된 응답이 캐시에 저장되어 이후 사용자에게 반복 전달되는 상태
  주로 발생 위치: CDN 엣지 캐시, 리버스 프록시 캐시, 공유 프록시 캐시
- 공급망(supply chain) 위협: CDN, 빌드 파이프라인, 의존성 패키지 등 배포 경로에서 콘텐츠가 변조되는 위험
- 무결성(integrity): 데이터가 전송/배포 과정에서 바뀌지 않았다는 성질

## 적용 내용

- 배경:
  `nosniff`가 없으면 브라우저가 MIME 타입을 "추측(sniffing)"할 수 있어, 서버가 선언한 타입과 다른 방식으로 해석될 여지가 생깁니다.
  특히 스크립트/스타일 로딩 경로에서 위험하며, 업로드 파일을 같은 오리진(같은 scheme+host+port)에서 서빙하는 서비스에서 자주 문제가 됩니다.
- 조치:
  Express 전역 응답(`csp.ts`), Express static 응답(`static.middleware.ts`), nginx가 직접 응답하는 경로(`/errors`, `/uploads`)에 모두 `nosniff`를 설정했습니다.
- 코드 위치:
  `server/src/middlewares/csp.ts`, `server/src/middlewares/static.middleware.ts`, `nginx/conf.d/default.conf`

### 왜 위험한가 (핵심 메커니즘)

1. 서버가 `Content-Type`으로 선언한 타입과, 브라우저가 실제로 처리하는 타입이 달라질 수 있음  
   (예: 서버는 `text/plain`으로 보냈는데 브라우저가 내용을 보고 스크립트처럼 해석)
2. 업로드 파일과 애플리케이션 페이지가 같은 도메인을 쓰면, 쿠키/세션 문맥이 공유되어 피해 범위가 커질 수 있음  
   (예: `https://example.com/uploads/...`와 `https://example.com/app`가 같은 쿠키를 공유하는 경우)

`nosniff`가 있으면 브라우저가 임의 추측을 줄이고, 특히 `script`/`style` 대상 MIME 불일치에 대해 더 엄격하게 차단합니다.

### 어떤 상황에서 특히 위험한가

| 상황 | 누락 시 위험 | 예시 |
| --- | --- | --- |
| 사용자 업로드 파일을 같은 도메인에서 직접 서빙 | 업로드가 의도와 다르게 해석/실행될 수 있음 | `/uploads/...` 경로에서 이미지/문서만 허용했다고 믿지만 실제 본문은 다른 형식 |
| 잘못된 `Content-Type` 설정 | 클라이언트가 타입을 추측해 실행 가능한 리소스로 오해할 수 있음 | JS 파일이 `text/plain`으로 내려가도 일부 환경에서 실행 시도 |
| 프록시/앱 서버 이중 구조(nginx + Express) | 일부 경로에만 헤더가 빠져 정책 불일치 발생 | `/errors`는 nginx가 직접 응답, `/api`는 Express가 응답 |
| 구형/혼합 클라이언트 지원 환경 | MIME 스니핑 관대 동작으로 공격 가능 범위 증가 | 구형 브라우저/내장 웹뷰/특수 클라이언트 |

### 실제 시나리오 예시 (학습용)

1. 스크립트 MIME 오지정 + 스니핑

    ```http
    GET /assets/app.js
    Content-Type: text/plain
    X-Content-Type-Options: (없음)
    ```

    브라우저/환경에 따라 본문이 JS처럼 해석될 여지가 생깁니다.  
    `nosniff`를 적용하면 스크립트 로딩 MIME 검사가 엄격해져 이런 오해석 가능성을 줄일 수 있습니다.

2. 업로드 파일 재해석 리스크

    ```http
    GET /uploads/posts/files/abc123
    Content-Type: application/octet-stream
    X-Content-Type-Options: (없음)
    ```

    애플리케이션은 "그냥 파일 다운로드"를 의도했더라도, 클라이언트가 내용을 추측해 다른 방식으로 처리할 수 있습니다.  
    그래서 업로드 경로는 `nosniff` + `Content-Disposition: attachment`를 함께 쓰는 것이 안전합니다.

3. 스타일시트 MIME 불일치

    ```http
    GET /assets/site.css
    Content-Type: text/plain
    X-Content-Type-Options: (없음)
    ```

    타입이 잘못 내려가도 일부 환경에서 관대 처리될 수 있습니다.  
    `nosniff` 적용 시 정책 위반이 빨리 드러나고, 잘못된 배포를 조기에 발견하기 쉬워집니다.

### 누락 시 취약해지는 서버 패턴 예시

```ts
app.use(express.static(publicDir)); // setHeaders 미설정
```

위 패턴은 정적 파일 응답에 `nosniff`가 자동 보장되지 않아, 경로/미들웨어 순서/프록시 구성에 따라 누락이 발생할 수 있습니다.

### 검증 예시

```bash
curl -I http://localhost/errors/common/sign_question.png
curl -I http://localhost/uploads/posts/images/<file>.webp
```

둘 다 `X-Content-Type-Options: nosniff`가 있어야 합니다.

추가로 아래도 함께 확인하는 것이 좋습니다.

```bash
curl -I http://localhost/assets/app.js
curl -I http://localhost/assets/site.css
```

정적 JS/CSS/이미지/업로드 응답 전반에서 `X-Content-Type-Options: nosniff`가 일관적으로 보이면 설정이 안정화된 상태입니다.

### `nosniff`의 보호 범위와 한계(경계)

| 항목 | `nosniff` 단독 효과 | 설명 |
| --- | --- | --- |
| `script`/`style` MIME 불일치 차단 강화 | 가능(효과 큼) | JS/CSS가 잘못된 `Content-Type`으로 내려올 때 관대 해석을 줄임 |
| 브라우저 MIME 추측(sniffing) 완화 | 가능(효과 큼) | 선언 타입과 실제 해석 간 불일치를 줄여 정책 일관성 향상 |
| 응답 본문의 의도적 위변조 탐지 | 불가 | 본문 무결성(변조 여부) 자체를 검증하는 헤더가 아님 |
| TLS MITM(신뢰 루트 인증서 주입 환경) 방어 | 불가 | HTTPS 종단 간 보장이 깨진 환경에서는 본문 교체를 막지 못함 |
| CDN/공급망 악성 변경 방어 | 불가 | 출처가 "정상 도메인"이어도 내용이 바뀌면 `nosniff`만으로는 차단 불가 |
| 정상 타입(`text/html`) 내 스크립트성 콘텐츠 방어 | 제한적 | 본문이 합법 타입이면 XSS 방어는 CSP/이스케이프/정제가 담당 |

정리하면, `nosniff`는 "해석 오해(타입 추측)"를 줄이는 보안 장치이고, "무결성 위변조"까지 막는 장치는 아닙니다.

### 중요한 경계: 공격자가 MIME 자체를 바꿀 수 있는가?

공격자가 **응답이 전달되는 경로**를 장악했을 경우 가능합니다.

1. MITM 성립(예: 단말에 신뢰 루트 인증서가 설치된 상태)  
클라이언트와 서버 사이에서 응답을 가로채 `Content-Type`, `Content-Disposition`, 본문을 함께 바꿀 수 있습니다.  
예: `/assets/app.js` 응답을 가로채 `Content-Type: application/javascript`로 유지한 채 본문만 변조해 전달

2. CDN/프록시/캐시 구간 오염  
원본 서버가 정상 응답을 내도, 중간 저장 구간의 오염된 응답이 사용자에게 전달될 수 있습니다.  
예: CDN 지역 캐시 서버(엣지 서버)에 변조된 `app.js`가 저장되어 같은 URL 요청마다 재사용됨

3. 공급망(빌드 산출물/의존성 패키지) 오염  
배포 전에 파일 자체가 이미 바뀌어 있으면, 서버가 정상 헤더를 내려도 악성 본문이 서비스됩니다.  
예: CI 빌드 단계에서 오염된 번들이 `/assets/app.js`로 배포됨

즉 `nosniff`는 "서버가 낸 타입을 브라우저가 멋대로 바꾸지 못하게" 하는 장치이고,  
"서버가 낸 타입/본문 자체가 위변조되는 상황"은 TLS 신뢰체인(인증서 신뢰 경로), 무결성 검증(SRI/해시), 공급망 통제가 담당합니다.

### 공격자 관점 비교: `nosniff` 없음 vs 있음

| 상태 | 공격자가 노리는 방식 | 성립 조건 | 공격자 한계 |
| --- | --- | --- | --- |
| `nosniff` 없음 | MIME 추측 유도(의도와 다른 해석 유도) | 업로드/정적 파일의 `Content-Type` 오지정, 브라우저가 선언 타입을 엄격히 따르지 않는 해석 | 서버가 파일 검증/다운로드 강제/도메인 분리/CSP를 잘 해두면 성공률 급감 |
| `nosniff` 없음 | MIME 오해석 + 다른 취약점이 연달아 이어지는 공격 단계(체인) | 저장형 입력 취약점, 업로드 검증 미흡, 같은 오리진 서빙 | 공격 단계 중 하나라도 차단되면 공격 실패 |
| `nosniff` 있음 | MIME 추측 기반 공격 | `script`/`style` MIME 검사가 더 엄격해져 난이도 상승 | 브라우저가 선언 타입을 따르므로 오해석 경로가 크게 제한됨 |
| `nosniff` 있음 | 응답 경로 장악 후 헤더/본문 동시 위변조 | MITM(신뢰 루트 주입), 프록시/캐시/공급망 오염 | `nosniff`는 이 계층 공격을 못 막음. TLS/무결성/SRI/운영 통제가 필요 |

실무 해석:

1. `nosniff`는 공격을 "불가능"하게 만드는 옵션이 아니라, MIME 오해석 계열의 공격 가능한 범위를 줄이는 옵션입니다.
2. 공격자는 `nosniff`가 있으면 MIME 추측 대신 공급망/프록시/앱 취약점이 이어진 공격 단계로 우회하려고 합니다.
3. 따라서 `nosniff`는 필수지만, 단독이 아니라 CSP/업로드 검증/무결성 통제와 함께 써야 합니다.

### `nosniff` 단독으로는 대응이 어려운 외부 위변조 시나리오(프록시/공급망)

| 시나리오 | 공격 성립 조건 | 권장 추가 방어 |
| --- | --- | --- |
| 로컬/사내 프록시(Burp 포함)로 HTTPS 중간변조 | 단말에 신뢰 루트 인증서가 설치됨 | 단말 인증서 정책 점검, HSTS, 관리형 단말 통제, 민감 구간 mTLS/네트워크 분리 |
| 외부 CDN 자산 변조/오염 | 외부 자산을 실시간 참조 | 가능하면 로컬 서빙, 불가피 시 SRI(`integrity`) + 엄격 CSP |
| CDN/리버스프록시 캐시 오염(cache poisoning) | 캐시 키/헤더 설계 취약(공유 캐시에 잘못된 응답 저장) | `Cache-Control` 설정 일치 여부 점검, 변조 감지 로그, 내용 해시가 포함된 파일명(immutable asset) |
| 배포 산출물(정적 JS/CSS) 공급망 오염 | CI/CD 또는 의존성 변조 | lockfile 고정, 아티팩트 해시 검증, 서명/무결성 검증 파이프라인 |
| 브라우저 확장/엔드포인트 악성코드 변조 | 클라이언트 런타임이 이미 오염됨 | EDR/보안 정책, 민감 작업 서버측 재검증, 이상행위 모니터링 |
