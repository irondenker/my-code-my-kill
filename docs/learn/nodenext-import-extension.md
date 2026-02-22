# `Typescript` `Node16` / `nodenext` 에서 `import` 확장자 문제

## 문제 상황

### `tsconfig.json` 설정

``` JSON
{
"compilerOption" : "nodenext"
} // 문제 상황의 `tsconfig.json` 설정 중 일부
```

### 빌드 시도

``` sh
# 빌드 명령어
cd server && npm run build
# 예상 결과: server/dist 경로에 빌드 결과물 생성
# 실제 결과: 오류, 빌드가 제대로 이루어지지 않음
```

## 문제 원인

- `nodenext` 설정 시, __ESM__ 문법 사용 강제
- __ESM__ 에서 `import`로 상대 경로 사용 시, __확장자 표기 필수__

``` Typescript
import { createUserForRegister } from "../services/auth-core.service"; // X
import { createUserForRegister } from "../services/auth-core.service.js"; // O
```

- `.ts` 파일 컴파일 후에도, `import` 구문은 별도의 처리없이 그대로 남아있음

## 해결 방법

- `import` 구문 사용 시 확장자 **`.js`**로 고정 __(\*.ts -> \*.js)__
- __컴파일__ 후 생성된 `.js` 파일을 __정상적으로 참조__ 하도록 만드는 조치

``` Typescript
// Error : An import path cannot end with a '.ts' extension. Consider importing './hello.js' instead.
import { createUserForRegister } from "../services/auth-core.service.ts"; // X

// Answer
import { createUserForRegister } from "../services/auth-core.service.js"; // O
```

## 👀 References

- [소면(Somyeon) - Blog](https://jjnooys.medium.com/node-js%EC%99%80-esm-2-typescript-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-esm%EC%9C%BC%EB%A1%9C-%EB%B3%80%ED%99%98%ED%95%98%EA%B8%B0-7266e8174906)
