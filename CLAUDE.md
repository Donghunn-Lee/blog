# CLAUDE.md

## 프로젝트

- Donghun Lee — velog에서 이전한 개인 기술 블로그. 라이브: https://donghunn-lee.vercel.app
- 목적은 포트폴리오에 넣을 게시글 제공. 포트폴리오 프로젝트가 아니므로 과한 추상화·테스트·신규 패턴 도입 금지, 템플릿 기존 패턴을 따른다
- 템플릿: timlrx/tailwind-nextjs-starter-blog v2.4.0 (Next 15.5 · React 19 · Tailwind 4 · contentlayer2 · pliny · yarn 3). MIT — 루트 `LICENSE` 삭제 금지
- 배포: Vercel, `main` push 시 자동(약 90초). GitHub Pages 미사용

## 명령

- `yarn start` dev · `yarn build` 빌드(+RSS) · `yarn serve -p 3001` 프로덕션 확인(3000은 slate-kr이 쓸 수 있음) · `yarn lint`
- `yarn build`·`yarn serve` 전에 `yarn start`(dev)를 끈다 — `.next`를 같이 써서 빌드 직후 dev 서버가 라우트 파일을 덮어쓰면 serve가 500을 낸다

## 절대 규칙

- `data/blog/` 아래 폴더·파일명 = URL. 변경 금지(이력서·README가 링크함)
- `data/blog/`는 `.prettierignore` 대상(하드 브레이크·코드 블록 보호). 여러 글에 걸친 수정은 일회성 codemod(`yarn tsx`)로 하고 스크립트는 커밋하지 않는다
- `app/tag-data.json`은 contentlayer가 생성(키 이름순 정렬). 손으로 수정 금지
- `siteMetadata.analytics`는 비워 두되 삭제 금지(layout이 참조)
- 새 글: `data/blog/<series>/<n>.mdx`, frontmatter `title/date/tags/summary/draft`(+ 선택 `category`). 이미지는 `public/static/images/<series>/` (`velog/`는 이전 글 이미지)
  - title에 말머리(`[SlateKR #192]` 등)를 쓰지 않는다. 번호는 파일명(`192`, `188-2`)에서 계산되고, 시리즈 이름·번호·`category`는 제목 윗줄과 탭 제목에 자동으로 붙는다
  - 새 시리즈 폴더는 `data/seriesData.ts`에 등록(안 하면 시리즈 페이지 404)
  - 움직이는 화면은 GIF 대신 mp4 + `<video autoPlay loop muted playsInline>`

## 커밋

- `type: summary` — `feat` `fix` `design` `content` `chore` `refactor` `docs`
- 제목은 영어 명령형 50자 이내, 본문은 필요할 때만(한국어 가능)
- 커밋 하나 = 의도 하나. 무관한 파일 섞지 않기(`tag-data.json` 변경은 원인이 된 글과 함께)
- 커밋은 요청받았을 때만. 커밋 전 `yarn build` 통과 확인

## 작업 방식

- 수정 전에 에러 메시지와 관련 코드를 먼저 본다. 추측 금지
- 라이브러리 추가 전 유지보수 상태·버전 호환 확인. 폐기 API는 표시
- 결과는 핵심만. 바뀐 파일·이유·검증 결과 순
