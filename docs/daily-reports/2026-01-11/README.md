# 일일 보고 (2026-01-11)

## 금일 작업 내용

1. **`Docker` && `Docker-Compose` 설정**
    * `dev`/`prod` 구성 및 `build` 플로우 정비
    * 개발/운영 환경용 `Docker-Compose` 구성 추가
    * `Dockerfile` 및 관련 설정 파일 정리

2. **`nginx` 추가**
    * 정적 파일 라우팅 구성
    * 배포 환경에서의 자산 제공 경로 확정

3. **에러 렌더링 로직 중앙화**
    * 에러 처리 흐름을 일원화하여 중복 감소
    * 에러 유틸 추가 및 컨트롤러 호출 구조 정리

4. **`controllers` 책임 분리 && `utils` 추가**
    * `controllers`에 과도하게 기능 포진
    * **인증/세션** 관련 책임 분리 -> **관련 `utils` 추가**
    * `controllers`에서 `utils` 모듈 참조 이용

5. **문서 보강**
    * `/README.md` 업데이트 **(`Docker` 환경    대응)**
    * `docs/troubleshoot` 경로 추가
        * **목적:** 개발 중 문제해결 기록 목적
        * **문서 추가** (총 1건)
            * [nodenext-import-extension](../../learn/nodenext-import-extension.md)

6. **Minor Fixes**
    * **디렉터리 제거:** `mocks`, `_graveyard`
    * **디렉터리 이름 변경:** `sections` → `components`
    * **`/public/assets` 위치 재배치:**
        * `/assets/vendor/bootstrap-5.3.8` → `/assets/css`, `/assets/js`, `/assets/icons`
    * **`footer` 개선**: `GitHub` / `Blog` 아이콘 및 링크 업데이트

## 차후 계획 중인 작업

1. `errors` 로직 중앙화 및 단일화
2. VM을 통한 모의 배포 환경 구성
3. `Docker` && `Docker-Compose` 세부 설정
4. `favicon` 생성 및 설정
    * `UI/UX` 개선
    * 프로젝트의 **상징성 강화**
5. `.html` & `.ejs` 파일 `<title>` 전면 개편 필요
    * 현재 전부 `Document` **기본값으로 설정됨**
