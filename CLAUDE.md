# CLAUDE.md

## 프로젝트

- Ethan's Dev Log — velog에서 이전한 개인 기술 블로그. 라이브: https://donghunn-lee.vercel.app
- 목적은 포트폴리오에 넣을 게시글 제공. 포트폴리오 프로젝트가 아니므로 과한 추상화·테스트·신규 패턴 도입 금지, 템플릿 기존 패턴을 따른다
- 템플릿: timlrx/tailwind-nextjs-starter-blog v2.4.0 (Next 15.5 · React 19 · Tailwind 4 · contentlayer2 · pliny · yarn 3). MIT — 루트 `LICENSE` 삭제 금지
- 배포: Vercel, `main` push 시 자동(약 90초). GitHub Pages 미사용

## 명령

- `yarn start` dev · `yarn build` 빌드(+RSS) · `yarn serve -p 3001` 프로덕션 확인(3000은 slate-kr이 쓸 수 있음) · `yarn lint`
- `yarn tsx scripts/migrate-velog.ts` — velog 백업(`../velog-archive`) 재변환. **`SERIES_RULES`의 9개 폴더와 `public/static/images/velog/`를 통째로 지우고 다시 쓴다.** 그 폴더에 손으로 쓴 글이 있으면 실행 금지

## 절대 규칙

- `data/blog/` 아래 폴더·파일명 = URL. 변경 금지(이력서·README가 링크함)
- 이전된 글(`data/blog/*`)은 `.prettierignore` 대상. 포맷·일괄 수정 금지 — 수정은 스크립트 규칙으로
- `app/tag-data.json`은 contentlayer가 생성(키 이름순 정렬). 손으로 수정 금지
- `siteMetadata`의 `analytics`·`newsletter` 블록은 비워 두되 삭제 금지(크래시)
- 새 글: `data/blog/<series>/<n>.mdx`, frontmatter `title/date/tags/summary/draft`. 이미지는 `public/static/images/<series>/` (`velog/`는 스크립트 소유)

## 커밋

- `type: summary` — `feat` `fix` `design` `content` `chore` `refactor` `docs`
- 제목은 영어 명령형 50자 이내, 본문은 필요할 때만(한국어 가능)
- 커밋 하나 = 의도 하나. 무관한 파일 섞지 않기(`tag-data.json` 변경은 원인이 된 글과 함께)
- 커밋은 요청받았을 때만. 커밋 전 `yarn build` 통과 확인

## 작업 방식

- 수정 전에 에러 메시지와 관련 코드를 먼저 본다. 추측 금지
- 라이브러리 추가 전 유지보수 상태·버전 호환 확인. 폐기 API는 표시
- 결과는 핵심만. 바뀐 파일·이유·검증 결과 순
