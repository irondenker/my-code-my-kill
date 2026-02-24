# My Code, My Kill

![My Code, My Kill Slogan with Background](./docs/assets/slogan-bg.png)

![My Code, My Kill Screenshot](./docs/assets/screenshot.png)

---

## 📌 Abstract

`My Code, My Kill`은 웹 보안 취약점을 직접 재현하고 분석하며 대응까지 이어가는 실습형 프로젝트입니다.

## 📚 Docs Hub

- **[전체 문서 인덱스](./docs/README.md)**

### 🚀 First Run

- [품질 게이트 초기 설정](./docs/guide/first-run/quality-gates.md)
- [Docker 첫 실행](./docs/guide/first-run/first-run-docker.md)
- [VM 첫 실행](./docs/guide/first-run/first-run-vm.md)

### 🗺️ Flowmap

- [Flowmap 인덱스 조회](./docs/flowmap/README.md)
- [Session Access 맵 조회](./docs/flowmap/session-access.mmd)

### 📝 How To Commit

- [커밋 이모지 가이드](./docs/guide/commit-emoji-guide.md)

## 🧪 Seed Assets Prep

에셋 준비 스크립트는 seed 실행과 분리되어 있습니다. 아래 순서로 한 번 준비한 뒤 시더에서 재사용하세요.

```bash
cd server
npm run assets:fetch
npm run assets:avatars
npm run assets:files
npm run seed
```

- `assets:fetch`: Lorem Picsum 게시글 이미지 raw 대량 다운로드 (`seed-assets/raw/post-images`)
- `assets:avatars`: 로컬 생성형 webp 아바타 raw 생성 (`seed-assets/raw/avatars`)
- `assets:files`: 업로드 whitelist 기반 첨부 raw 생성 (`seed-assets/raw/files`)
- `seed`: 업로드 파이프라인을 재사용해 유저/게시글/첨부/감사로그 현실형 더미 데이터 시딩
  - seed 실행 시 주요 테이블(`users`, `boards`, `posts`, `board_post_counters`, `audit_logs`)을 reset 후 재생성

## 🔗 Links

- [GitHub](https://github.com/irondenker/my-code-my-kill)
- [Project Blog](https://irondenker.tistory.com/category/Projects)

## 🗂️ References

- <https://getbootstrap.com/docs/5.3/examples/>
- <https://www.toptal.com/developers/gitignore>
- <https://techicons.dev/>
- <https://www.flaticon.com/kr/>
- <https://www.svgrepo.com/>
- <https://icons.getbootstrap.com/>

## ⚖️ License

This project is licensed under the MIT License.  
See [`LICENSE`](./LICENSE) for details.
