# Contributing

이 저장소(`visual-decisions-plugin`)에 기여하는 방법을 정리한다.

## 저장소 구성 방식

- 플러그인 하나당 저장소 하나로 관리한다. 이 저장소의 루트가 곧 플러그인이며, 저장소 이름은 `<플러그인 이름>-plugin` 형식을 따른다.
- 설치용 목록은 별도의 마켓플레이스 저장소 [kimeloo/claude-plugin-marketplace](https://github.com/kimeloo/claude-plugin-marketplace)가 가진다. 그 저장소는 목록(`marketplace.json`)만 관리하고, 이 저장소의 코드와 버전은 건드리지 않는다.
- 이 저장소를 고쳐도 마켓플레이스 저장소를 수정할 필요는 없다. 플러그인을 추가하거나 제거할 때만 목록을 고친다.
- 플러그인이 여러 개로 늘어도 같은 방식을 유지한다. 개발 PC에서는 `claude-plugins/` 같은 상위 폴더 아래에 플러그인 저장소와 마켓플레이스 저장소를 나란히 둔다.

```
claude-plugins/
├── claude-plugin-marketplace/     ------ 목록 저장소
├── visual-decisions-plugin/       ------ 이 저장소
└── <다른 플러그인>-plugin/
```

## 개발 환경

- Claude Code
- Node.js 18 이상
- 외부 의존성은 추가하지 않는다. 하네스는 Node 내장 모듈만 사용한다.

## 작업 흐름

1. 이슈를 먼저 남기거나 기존 이슈에서 논의한다.
2. 브랜치를 만들어 작업한다. 브랜치 이름은 `feature/<주제>` 또는 `hotfix/<주제>`를 사용한다.
3. 변경을 커밋한다. 논리적 단위마다 커밋한다.
4. 아래 검증을 통과시킨 뒤 Pull Request를 연다.

## 커밋 메시지

- 제목 형식: `<type>: <summary>` (type과 summary는 영어, summary는 소문자로 시작하고 50자 이내의 명령형)
- type: `feat`, `fix`, `refactor`, `docs`, `chore`
- 본문은 필요할 때만 작성하며, 어느 시점에서 읽어도 이해할 수 있게 적는다.

## 변경 후 검증

```bash
claude plugin validate .
node skills/decision-board/harness/selftest.mjs
```

- `harness/`나 `templates/`를 고쳤다면 `selftest.mjs`가 통과해야 한다.
- 화면(`harness/public/`)을 고쳤다면 실제 브라우저에서 라이트와 다크 모두 확인한다. 자동 테스트는 화면 렌더링을 검사하지 않는다.
- 만든 페이지는 `node skills/decision-board/harness/verify.mjs <작업 폴더>`로 정적 검사를 한다.

## 문서 언어 규칙

- 에이전트가 읽는 지침(`SKILL.md`, `references/`, 스크립트 주석과 출력)은 영어로 쓴다.
- 사용자에게 보이는 글(하네스 화면 문구, 페이지에 들어가는 안내, 저장소 문서)은 한국어로 쓴다.
- `SKILL.md`의 frontmatter `description`에는 한국어 호출 문구를 유지한다.

## 버전과 릴리스

1. `.claude-plugin/plugin.json`의 `version`을 올린다. 올리지 않으면 설치한 PC에 변경이 반영되지 않는다.
2. `CHANGELOG.md`의 `[Unreleased]` 블록 제목을 `[vX.Y.Z]`로 바꾸고 날짜를 갱신한다.
3. 변경을 `main`에 병합한 뒤 `vX.Y.Z` 태그를 만든다.
4. 마켓플레이스 저장소는 수정하지 않는다. 설치한 PC는 `claude plugin marketplace update kimeloo`와 `claude plugin update visual-decisions@kimeloo`로 받는다.

버전 규칙은 Semantic Versioning을 따른다. 동작이 바뀌지 않는 수정은 패치, 기능 추가는 마이너, 기존 호출 방식이나 저장 형식이 깨지는 변경은 메이저로 올린다.

## 이슈와 Pull Request

- 버그 제보, 개선 제안, 문의는 GitHub Issues에 남긴다.
- Pull Request에는 무엇이 왜 바뀌는지와 확인한 방법을 적는다.

## 라이선스

기여한 내용은 이 저장소와 같은 [Apache License 2.0](LICENSE)으로 배포되는 것에 동의한 것으로 본다.
