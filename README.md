# My Code, My Kill
>
> 웹페이지 제작 및 모의해킹 실습 프로젝트

## 😊 Commit Emoji

| emoji | commit message | when to use it              |
| :---: | :------------: | :-------------------------: |
| 🎉    | Start          | 프로젝트 시작               |
| ✨    | Feat           | 새로운 기능 추가            |
| 🐛    | Fix            | 버그 수정                   |
| ♻️    | Refactor       | 코드 리팩터링               |
| 💄    | Style          | 스타일 추가 및 업데이트     |
| 📦    | Chore          | 패키지 추가 및 업데이트     |
| 📚    | Docs           | 그 외 문서 추가 및 업데이트 |

<!-- 

🎉 Start: 
✨ Feat: 
🐛 Fix: 
♻️ Refactor: 
💄 Style: 
📦 Chore: 
📚 Docs: 

-->

## 🔗 Project Links

👉 **GitHub Repository**  
<https://github.com/irondenker/my-code-my-kill>  

👉 **Proj. Blog**  
<https://irondenker.tistory.com/category/Projects>

## ⚙️ Getting Started

### ⚙️ Config

1. [Docker](https://www.docker.com/) 설치(필수)

2. Repository 다운로드:
    - `Download ZIP manually` or `git clone`

3. 프로젝트 루트 경로로 이동:
    - `.../my-code-my-kill` or `.../my-code-my-kill-main`

4. '.env' && '.env.production' -> '/server' 경로에 옮겨놓기
    - 없을 경우 자체 구성

5. `Terminal`에서 아래 명령어 입력

```bash
docker compose -f docker-compose.prod.yml up --build
```

### 🎮 Controls

```bash

# 컨테이너 켜기(단순 켜기, 빌드 과정 / 강제 리빌드 없음)
docker compose -f docker-compose.prod.yml up
# 컨테이너 끄기
docker compose -f docker-compose.prod.yml down
# 컨테이너 강제 리빌드 후 켜기
docker compose up -f --force-recreate

```

### 💻 Dev (Docker)

``` bash
#개발용 세팅 (세부 설정 사항은 위와 같음)
docker compose up -d --build
docker compose -d up
docker compose -d down
docker compose up -d --force-recreate
```

### 🏠 Local

``` bash
### 로컬에 Node.js 설치 필요!

#로컬 nodemon 켜기
npm run dev
#로컬에서 build 후 켜기(Nginx 미적용)
npm start
```

## 👀 References

- <https://getbootstrap.com/docs/5.3/examples/>
- <https://www.toptal.com/developers/gitignore>
- <https://techicons.dev/>
- <https://www.flaticon.com/kr/>
- <https://www.svgrepo.com/>
- <https://icons.getbootstrap.com/>

## 📄 License

This project is licensed under the MIT License.  
See the [LICENSE](./LICENSE) file for details.
