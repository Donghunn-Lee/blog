# Donghun Lee

프론트엔드 개발 기록을 모아 두는 개인 기술 블로그입니다(velog에서 이전). → https://donghunn-lee-blog.vercel.app

## 스택

- Next.js 15 · React 19 · Tailwind CSS 4 · Contentlayer2 · Pliny · Yarn 3 · Vercel 배포
- 템플릿: [timlrx/tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog) (MIT, [LICENSE](LICENSE))

## 글 작성

`data/blog/<series>/<n>.mdx`에 씁니다. 폴더·파일명이 곧 URL(`/blog/<series>/<n>`)이므로 정한 뒤에는 바꾸지 않습니다. 이미지는 `public/static/images/<series>/`에 둡니다.

```yaml
---
title: '글 제목'
date: 2026-11-08
tags: ['react', 'frontend']
summary: '목록에 보일 한두 문장 요약'
draft: false
---
```

## 로컬 실행

```bash
yarn          # 의존성 설치
yarn start    # 개발 서버 (http://localhost:3000)
yarn build    # 프로덕션 빌드 + RSS 생성
```
