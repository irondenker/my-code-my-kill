# 🔥 웹 보안/웹 해킹 4계층 기반 종합 요점정리

## 🔥 구조 개요

### A. 통제 지점 (Control Plane)

1. Network / Infrastructure
2. Server / Application
3. Web Origin Sandbox
4. Browser Privileged Context
5. Endpoint / OS Privileged

---

## 통제 지점 (Control Plane)

### 🧱 Layer 1 — 네트워크 / 인프라 레이어

> 이 요청이 서버까지 도달할 수 있는가?
> 그리고 통신은 신뢰 가능한가?

범위

* TLS
* Proxy
* CDN
* DNS
* LB
* WAF

#### 1. TLS / HTTPS

* 암호화 강제 여부
* HSTS 설정 여부
* 약한 암호군 사용 여부
* 중간자 공격 가능성

📌 공격 관점:

* SSL stripping
* 잘못된 인증서 신뢰
* 내부망 평문 통신

#### 2. Reverse Proxy / Gateway (Nginx 등)

* proxy_pass 구성
* 내부 IP 노출 여부
* X-Forwarded-* 신뢰 여부
* 업스트림 헤더 필터링 여부

📌 공격 관점:

* Host 헤더 인젝션
* 내부 서비스 우회
* proxy misconfiguration
* cache poisoning

#### 3. WAF / Rate Limiting

* 비정상 트래픽 탐지
* brute force 방지
* 과도 요청 제한

📌 공격 관점:

* 우회 패턴 (encoding, case)
* rate limit race
* path normalization 우회

#### 4. 경계 분리

* 내부망과 외부망 분리
* 관리자 인터페이스 외부 노출 여부
* 업로드 디렉토리 실행 권한

DNS 공격
BGP hijacking
CDN 오염
Cloud Load Balancer 오설정

### Layer 2 — Server / Application Stack

> 서버는 무엇을 신뢰하고 있는가?
> 어디에서 검증을 놓쳤는가?

범위

* App Logic
* Auth / Session
* DB
* Server OS
* Internal Service
* File System

#### 1. 입력 검증 (Input Validation)

* 타입 검증
* 길이 제한
* 화이트리스트 기반 검증
* 예상하지 못한 중첩 구조

📌 공격:

* SQLi
* Command Injection
* Template Injection
* NoSQL Injection

#### 2. 출력 인코딩 (Output Encoding)

* HTML context
* Attribute context
* JS context
* JSON context

📌 공격:

* Reflected XSS
* Stored XSS
* DOM XSS

#### 3. 인증 (Authentication)

* 세션 vs JWT
* 세션 고정 공격
* 만료 정책
* 다중 로그인 처리

📌 공격:

* 세션 탈취
* 토큰 재사용
* remember-me 악용

#### 4. 인가 (Authorization)

* 서버에서 권한 검증하는가?
* IDOR 존재 여부
* Role 기반 분기 로직
* 상태 전이 검증

📌 공격:

* 수평 권한 상승
* 수직 권한 상승
* 관리자 API 직접 호출

#### 5. 상태 관리 (State Management)

* 결제 상태 변경 로직
* 중복 요청 처리
* race condition
* 비동기 처리 신뢰 붕괴

📌 공격:

* 더블 스펜딩
* 중복 쿠폰
* 상태 우회

#### 6. 파일 업로드

* 확장자 화이트리스트
* MIME 검증
* 파일 이름 검증
* 저장 위치 실행 권한

📌 공격:

* 웹쉘 업로드
* 경로 조작
* 이미지 폴리글랏

#### 7. 내부 통신 (SSRF 관점)

* 외부 URL fetch 기능
* 내부 메타데이터 접근 가능 여부
* localhost 접근 차단 여부

📌 공격:

* AWS metadata 탈취
* 내부 관리자 API 접근

### 🌐 Layer 3 — Web Sandbox

> Origin 기반 정책이 강제되는 영역

범위

* 브라우저 엔진
* WebView
* JS
* DOM
* 쿠키
* localStorage
* sessionStorage
* Service Worker
* WebView
* PWA (Progressive Web App)

#### 1. CSP

* nonce 기반 정책 여부
* unsafe-inline 사용 여부
* connect-src 제한 여부
* frame-ancestors 설정

📌 한계:

* 서버 취약점 제거 못함
* 신뢰된 JS 내부 DOM 조작 못 막음

#### 2. Same-Origin Policy(SOP)

* 출처 분리 구조
* 서브도메인 신뢰 구조

#### 3. CORS

* 허용 Origin 범위
* credentials 허용 여부

📌 공격:

* 잘못된 wildcard
* reflected origin 허용

#### 4. Cookie 정책

* HttpOnly
* Secure
* SameSite

📌 공격:

* CSRF
* 세션 탈취

#### 5. Frame 보호

* X-Frame-Options
* frame-ancestors

📌 공격:

* 클릭재킹

### 🌐 Layer 4 — Browser

> 브라우저 내부이지만 Origin 모델을 초월하는 영역

범위

* 브라우저 확장 (WebExtension)
* DevTools
* Extension background script
* Browser internal APIs
* Native Messaging 인터페이스 (브라우저 쪽)

📌 특징

* CSP 우회 가능
* SOP 우회 가능
* 탭 간 접근 가능

### 💻 Layer 5 — Endpoint

> 사용자 환경은 신뢰 가능한가?
> 브라우저 보안 모델을 초월할 수 있는가?

범위

* 네이티브 `.exe`
* 키로거
* ARP spoofing
* 로컬 프록시
* 인증서 변조
* 시스템 레벨 보안 모듈
* 패킷 캡처 도구
* 루팅/탈옥
* Native Host App(WebExtension과 소통)
* 브리지 인터페이스(JS가 OS API 호출, 예시 - `window.Android.getFile()`)
* OS 루트 CA 설치

📌 특징:

* 네트워크 가로채기 가능
* 쿠키 파일 직접 접근 가능
* 브라우저 sandbox 우회 가능
* 프로세스 메모리 접근 가능
* 모든 웹 보안 무력화
