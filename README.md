<div align="center">
  <h1>visual-decisions-plugin</h1>
  <p>
    여러 결정을 로컬 HTML 페이지로 한 번에 묻고, 선택지 목업을 나란히 비교하며 답을 받는 Claude Code 플러그인
    <br />
    <br />
    <br />
    주요 문서
    <br />
    <a href="CHANGELOG.md"><strong>CHANGELOG</strong></a> ·
    <a href="CONTRIBUTING.md"><strong>CONTRIBUTING</strong></a> ·
    <a href="https://github.com/kimeloo/claude-plugin-marketplace"><strong>마켓플레이스</strong></a>
  </p>
</div>

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [로컬 환경 세팅 및 실행 방법](#4-로컬-환경-세팅-및-실행-방법)
5. [업데이트 및 릴리스](#5-업데이트-및-릴리스)
6. [관련 저장소](#6-관련-저장소)
7. [이슈 및 문의](#7-이슈-및-문의)

## 1. 프로젝트 개요
* 배경: 에이전트가 결정 사항을 대화로만 묻다 보면 모양, 배치, 색처럼 눈으로 보고 골라야 하는 결정을 전달하기 어렵다. 결정마다 사실, 스크린샷, 선택지 목업을 나란히 보여 주고 사용자가 한 번에 고르게 하기 위해 만들었다.
* 핵심 역할:
  - 로컬 HTML 페이지 묶음(결정 보드)을 만들고 작은 Node 서버로 띄운다.
  - 사용자가 라디오, 체크박스, 메모로 고른 답을 서버가 `answers.json`에 바로 저장한다.
  - 탭마다 답한 진행과 에이전트의 확인 여부를 보여 주고, 확인 뒤 답이나 페이지가 바뀌면 "수정됨"으로 알린다.
* 호출: `/visual-decisions:decision-board` 또는 "결정 보드", "시각적으로 보여줘" 같은 요청

## 2. 기술 스택
- Language : JavaScript (Node.js 18 이상, ES Modules)
- Framework : 없음 (Node 내장 모듈만 사용, 외부 의존성 없음)
- Database : 없음 (답은 작업 폴더의 JSON 파일에 저장)
- Build Tool : 없음
- CI/CD: 없음 (`claude plugin validate`와 자체 스모크 테스트로 검증)

## 3. 디렉토리 구조

```
.
├── .claude-plugin/
│   └── plugin.json                  ------ 플러그인 이름, 버전, 라이선스
├── skills/
│   └── decision-board/              ------ 플러그인이 제공하는 skill
│       ├── SKILL.md                 ------ 에이전트가 읽는 진입 지침(영문)
│       ├── references/              ------ 해당 단계에서만 읽는 상세 지침
│       ├── templates/               ------ 작업 폴더를 만들 때 복사하는 골격
│       └── harness/                 ------ 서버, 공통 CSS/JS, 확인·검증 스크립트
│           └── public/              ------ 브라우저에 내주는 공통 화면
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── NOTICE
```

저장소 구성 방식: 플러그인 하나당 저장소 하나로 관리한다. 이 저장소의 루트가 곧 플러그인이다. 설치용 목록은 별도의 마켓플레이스 저장소가 가지며, 자세한 내용은 [6. 관련 저장소](#6-관련-저장소)를 참조한다.

## 4. 로컬 환경 세팅 및 실행 방법

1. 필수 설치 항목
   - Claude Code
   - Node.js 18 이상
2. 설치
   ```bash
   claude plugin marketplace add kimeloo/claude-plugin-marketplace
   claude plugin install visual-decisions@kimeloo
   ```
   - 포크해서 비공개로 쓰는 경우 설치하는 PC에서 git 인증이 비대화형으로 동작해야 한다. SSH 키를 ssh-agent에 등록하거나 `gh auth login` 후 `gh auth setup-git`을 실행한다.
3. 개발 중 검증
   - 매니페스트 검증: `claude plugin validate .`
   - 하네스 스모크 테스트: `node skills/decision-board/harness/selftest.mjs`
4. 하네스 직접 실행(디버깅용)
   - 작업 폴더 생성: `node skills/decision-board/harness/init.mjs <작업 폴더> --port 5190`
   - 서버 실행: `node skills/decision-board/harness/server.mjs <작업 폴더>`

## 5. 업데이트 및 릴리스

- 설치한 PC에서 업데이트하는 방법
  ```bash
  claude plugin marketplace update kimeloo
  claude plugin update visual-decisions@kimeloo
  ```
- 버전은 `.claude-plugin/plugin.json`의 `version`으로만 관리한다. 값을 올리지 않으면 변경을 push해도 설치된 PC에 반영되지 않는다.
- 릴리스 절차(버전 올리기, CHANGELOG 정리, 태그)는 [CONTRIBUTING.md](CONTRIBUTING.md)를 따른다.

## 6. 관련 저장소

| 저장소 | 역할 |
|---|---|
| [kimeloo/claude-plugin-marketplace](https://github.com/kimeloo/claude-plugin-marketplace) | 설치용 목록(마켓플레이스). 이 플러그인을 가리키는 항목만 가지고 있다. |

- 마켓플레이스 저장소는 목록만 관리하고, 각 플러그인은 자기 저장소에서 코드와 버전을 관리한다.
- 이 저장소를 고쳐도 마켓플레이스 저장소를 수정할 필요는 없다. 플러그인을 추가하거나 제거할 때만 목록을 고친다.

## 7. 이슈 및 문의
문의, 버그 제보, 개선 제안은 [GitHub Issues](https://github.com/kimeloo/visual-decisions-plugin/issues)에 남긴다.
