# 세션 라이프사이클 정리

이 문서는 현재 코드 기준으로 세션이 어떻게 생성 / 파기 / 재생성 과정 일체에 대해 설명하기 위해 만들어졌습니다.

## 1. 세션 기본 설정

- 코드 위치: `server/src/middlewares/session.middleware.ts`
- 쿠키 이름: `mcmk.sid`
- 주요 옵션:
  - `resave: false`
  - `saveUninitialized: false`
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `maxAge: 30분`
- **옵션별 역할 설명**
  - `resave: false`
    - 요청 중 세션 데이터 미변경 시 -> 세션 재저장 안 함
    - 불필요한 저장/쓰기 경쟁 감소
  - `saveUninitialized: false`
    - 새 세션에 값 미기록 시 -> 저장/쿠키 발급 안 함
    - 익명 사용자 대상 빈 세션 쿠키 남발 방지
  - `cookie.httpOnly: true`
    - 브라우저 JS(`document.cookie`) 접근 -> 차단
    - XSS 발생 시 쿠키 탈취 난이도 상승
  - `cookie.secure: cookieSecure`
    - HTTPS 요청에서만 쿠키 전송
    - 평문 HTTP 구간 쿠키 노출 위험 감소
  - `cookie.sameSite: "lax"`
    - 크로스 사이트 요청 쿠키 전송 -> 제한
    - CSRF 공격면 감소
  - `cookie.maxAge: 1000 * 60 * 30`
    - 쿠키 유효 시간 -> 30분 제한
    - 탈취 쿠키 악용 가능 시간 감소

- `store`를 별도 미지정
  - 기본 `MemoryStore` 사용 (`Memory`에 **휘발성** 저장)

- **프로젝트 내 관련 코드**

    ```ts
    app.use(createSessionMiddleware());

    // session.middleware.ts
    return session({
        name: "mcmk.sid",
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, secure: cookieSecure, sameSite: "lax", maxAge: 1000 * 60 * 30 },
    });
    ```

## 2. 세션에 저장되는 데이터

- 코드 위치: `server/src/types/express-session.d.ts`
- 로그인 세션 핵심 정보: `userId`, `userRole`, `username`
- 로그인 직후 프로필 반영 값: `profileImageUrl`

## 3. 생성/재생성/파기 사이클

### 3-1. 생성(또는 신규 발급)

#### A. 회원가입 성공 시

- 코드 위치: `server/src/controllers/auth.controller.ts`
- 처리 흐름
  1. `postRegister`에서 `regenerateSession(req)` 호출
  2. 새 세션에 인증 필드(`userId`,`userRole`,`username`,`profileImageUrl`) 기록
  3. `saveSession(req)`로 즉시 **저장**
      - 저장 위치: **서버** 프로세스 메모리(`MemoryStore`)
      - 저장 키: 세션 ID(`sid`)
      - 저장 형태:
        1. `세션 객체` -(직렬화)-> `JSON` 문자열
        2. `cookie` &`사용자 필드` 저장

        ```js
        // MemoryStore 내부 개념 예시
        sessions["Yn-h2TVBI7bupdbBFev3YiLrqgB0hJLN"] = JSON.stringify({
        cookie: {
            originalMaxAge: 1800000,
            expires: "2026-02-11T08:30:00.000Z",
            httpOnly: true,
            secure: false,
            sameSite: "lax",
        },
        userId: 17,
        userRole: "user",
        username: "alice",
        profileImageUrl: null,
        });
        ```

      - **브라우저 `Devtool`**에서 보이는 형태:
        1. `세션 객체` -(직렬화)-> `JSON` 문자열
        2. `cookie` &`사용자 필드` 저장

        ```js
        // 브라우저 내 쿠키 예시
        {
          Name: mcmk.sid,
          Value: s%3AYn-h2TVBI7bupdbBFev3YiLrqgB0hJLN.<Signiture>
          // 정보: Value를 디코딩하면 서버에 저장된 형태와 동일해짐
          // 예: s:Yn-h2TVBI7bupdbBFev3YiLrqgB0hJLN.<서명값>
        }
        ```

  - 결과: **새로운 `sid` 쿠키 발급**

- **참고: 프로젝트 내 관련 코드**

    ```ts
    await regenerateSession(req);
    req.session.userId = user.userId;
    req.session.userRole = user.userRole;
    req.session.username = user.username;
    await saveSession(req);
    ```

#### B. 로그인 성공 시

- 코드 위치: `server/src/controllers/auth.controller.ts`
- 처리 흐름
  1. `postRegister`에서 `regenerateSession(req)` 호출
  2. 새 세션에 인증 필드(`userId`,`userRole`,`username`,`profileImageUrl`) 기록
  3. `saveSession(req)` 새로운 `세션 값` **생성**
  4. 기존 `세션 값`을 **덮어쓰기**
  - 결과: 기존 `세션 값` **폐기** -> 새로운 `세션 값`으로 **교체**

- **참고: 프로젝트 내 관련 코드**

    ```ts
    await regenerateSession(req);
    req.session.userId = user.userId;
    const profile = await findUserProfileById(user.userId);
    req.session.profileImageUrl = profile?.profileImageUrl ?? null;
    await saveSession(req);
    ```

### 3-2. 재생성(regenerate)

- 코드 위치:
  - `server/src/utils/session.util.ts`
  - `req.session.regenerate(...)` (**세션 재발급** 메서드)
- 구현 의도 및 기능:
  - **세션 고정(Session Fixation)** 방지
  - **세션 ID 재사용** 방지
- 사용처:
  - `로그인`: 기능 사용 시 **매번 메서드 호출**
  - `회원가입`: 기능 사용 시 **매번 메서드 호출**

- **참고: 프로젝트 내 관련 코드**

    ```ts
    export function regenerateSession(req: Request): Promise<void> {
        return new Promise((resolve, reject) => {
            req.session.regenerate((err) => (err ? reject(err) : resolve()));
        });
    }
    ```

### 3-3. 파기(destroy)

- 코드 위치:
  - `server/src/controllers/auth.controller.ts`
    - `req.session.destroy(...)`
    - `res.clearCookie("mcmk.sid")`
- 결과: 서버 세션 데이터 삭제 + 클라이언트 쿠키 제거

- **참고: 프로젝트 내 관련 코드**

    ```ts
    await destroySession(req);
    res.clearCookie("mcmk.sid");
    return res.redirect("/");
    ```

## 4. 로그인 세션 검증 흐름

### 4-1. 권한 체크

- 코드 위치: `server/src/middlewares/auth.middleware.ts`

- 구현 의도 및 기능:
  - `requireAuth`
    - `req.session.userId`가 **없으면**: `401 Unauthorized` 반환
  - `requireAuthRedirect`
    - 로그인 페이지로 **리다이렉트**: `302 Redirect`
    - **리다이렉트** 후 이전 사용자의 위치에서: `200 OK`
  - `requireAdminRedirect`:
    - `userRole !== "admin"`이면: `403(Forbidden)` 반환

- **참고: 프로젝트 내 관련 코드**

    ```ts
    if (!req.session.userId) {
        return next(new HttpError(401, "Unauthorized"));
    }
    if (!req.session.userId) {
        return res.redirect("/login");
    }
    if (req.session.userRole !== "admin") {
        return next(new HttpError(403, "Forbidden"));
    }
    ```

## 5. 글 CRUD 권한 검증

### 5-1. 권한 체크

- 코드 위치: `server/src/controllers/board.controller.ts`

- 구현 의도 및 기능:
  - `ViewerContext`
    - `viewerUserId`: 현재 로그인 중인 사용자의 `UserId`
      - 값의 출처: `req.session.userId`
        - `서버 세션 메모리`에서 값을 가져옴.
        - `req.session.userId`은 **클라이언트에 상에 저장하지 않음.**
          - `req`,`res`,`localStorage` 등 클라이언트에서 **위변조 가능한 형태로 있지 않음.**
        - `req.session.userId`은 서버 상에 **`const` 변수**로 저장
          - `const` 변수의 `불변성` 여부 확인 필요 (`Java`에서의 `String`처럼 `불변성`을 가지고 있는가?)
    - `isAuthenticated`: `viewerUserId`의 `Integer` 여부 검증 로직(중요하지 않음)
      - 이름이 다소 부적절, `isAuthenticated`가 중요한 인증 요소를 따지는 것 같은 느낌임, 수정 필요
    - `isAdmin`: 현재 로그인 중인 사용자의 역할이 `admin`인지 확인
      - 값의 출처: `req.session.userRole`
        - `서버 세션 메모리`에서 값을 가져옴.
        - `req.session.userId`은 **클라이언트에 상에 저장하지 않음.**
          - `req`,`res`,`localStorage` 등 클라이언트에서 **위변조 가능한 형태로 있지 않음.**
        - `req.session.userRole`은 서버 상에 **`const` 변수**로 저장
          - `const` 변수의 `불변성` 여부 확인 필요 (`Java`에서의 `String`처럼 `불변성`을 가지고 있는가?)
  - `getBoardEditForm`
    - `isOwner`: 수정하려는 글 작성자의 `userId`와 `viewerUserId`가 일치하는지 여부 확인
      - `viewerUserId` 값의 출처: `req.session.userRole`
        - `서버 세션 메모리`에서 값을 가져옴.
        - `req.session.userId`은 **클라이언트에 상에 저장하지 않음.**
          - `req`,`res`,`localStorage` 등 클라이언트에서 **위변조 가능한 형태로 있지 않음.**
        - `req.session.userRole`은 서버 상에 **`const` 변수**로 저장
          - `const` 변수의 `불변성` 여부 확인 필요 (`Java`에서의 `String`처럼 `불변성`을 가지고 있는가?)

- **참고: 프로젝트 내 관련 코드**

    ```ts
    type ViewerContext = {
        viewerUserId: number;
        isAuthenticated: boolean;
        isAdmin: boolean;
    };
    ```

    ```ts
    function getViewerContext(req: Request): ViewerContext {
        const viewerUserId = Number(req.session.userId);
        const isAuthenticated = Number.isFinite(viewerUserId) && viewerUserId > 0;
        const isAdmin = req.session.userRole === "admin";
        
        return { viewerUserId, isAuthenticated, isAdmin };
    }
    ```

    ```ts
    export async function getBoardEditForm(req: Request, res: Response, next: NextFunction) {
        // ...
        const isOwner = viewerUserId === post.user_id;
        // ...
    }
    ```

## 6. 글 CRUD 권한 검증

- 코드 위치: `server/src/services/board.service.ts`
- 메서드명: `updateBoardPost`
- 취약한 이유

    ```SQL
    UPDATE posts
    SET title = :title,
        content = :content,
        image_url = :imageUrl,
        file_url = :fileUrl,
        updated_at = NOW()
    WHERE post_id = :postId
        AND use_yn = true
    RETURNING post_id
    ```

  위 코드에서,
  - `WHERE post_id = :postId`
    - `SQL` 구문에서는 `postId` 하나로만 글 조회
    - `SQL` 구문 상 **권한 검증 로직 부족**
  - **백엔드 로직에서만** `isAdmin`, `isOwner` 권한 검증
    - 권한 인증 로직 누락 시, **`IDOR` 발생 가능성 존재**
  - **권한 검증 로직 이중화** 필요

- 안전한 코드 변경(예시)

    ```SQL
    UPDATE posts
    SET title = :title, content = :content, updated_at = NOW()
    WHERE post_id = :postId
      AND use_yn = true
      AND (:isAdmin = true OR user_id = :requestUserId);
      # <권한 검증 로직 이중화>
      # - requestUserId, isAdmin 파라미터 추가
      # - SQL WHERE에 소유자/admin 조건 추가
      # - DB 레벨에서 권한 인증을 강제
    ```

- 취약점 검증 방법(코드 변경 이전에 실시)
    1. 취약 조건 만들기
        - updateBoardPost를 소유자 체크 없이 직접 호출하는 라우트를 하나 임시로 만듭니다.
        ( 예: `POST /api/posts/:postId`에서 `req.params.postId`만 받아 `updateBoardPost(...)` 호출)
    2. 테스트 계정 준비
        - `userA`, `userB` 두 계정 생성 후,
        - `userA`로 게시글 1개 작성
    3. 재현 절차
        - `userB`로 로그인
        - `POST /api/posts/{userA의 postId}` 요청 전송
    4. 취약 판정 기준
        - 정상 반응: `403`
        - 취약 반응: `200` or `302`
            - userA 글 내용이 바뀜 **(IDOR/권한 누락)**
    5. 현재 코드와의 차이
        - `board.controller.ts`
            - 현재 `isOwner`/`isAdmin` 검증 존재
            - 일차적으로만 안전(백엔드에서만 권한 검증)
            - **안전한 설계가 아님**
        - 잠재적 문제 시나리오
            - `updateBoardPost` 재사용 && 취약한 백엔드 검증 로직 적용
            - `updateBoardPost`의 인증 로직 부족 이슈를 모르는 개발자에 의한 `board.controller.ts` 인증 로직 변경/삭제
