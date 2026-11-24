# visual-decisions-plugin

여러 결정을 로컬 HTML 페이지로 한 번에 묻고, 선택지 목업을 나란히 비교하며 답을 받는 Claude Code 플러그인이다. 답은 작은 Node 서버가 `answers.json`에 저장한다.

- skill: `decision-board` (호출: `/visual-decisions:decision-board`, 또는 "결정 보드", "시각적으로 보여줘" 같은 요청)
- 탭별 진행 표시, 에이전트 확인 여부와 확인 후 수정 감지, 3초 자동 갱신, 바뀐 컨트롤만 저장

## 설치

마켓플레이스 저장소: [kimeloo/claude-plugin-marketplace](https://github.com/kimeloo/claude-plugin-marketplace)

```bash
claude plugin marketplace add kimeloo/claude-plugin-marketplace
claude plugin install visual-decisions@kimeloo
```

요구 사항: Claude Code, Node 18 이상(하네스는 외부 의존성이 없다).

## 업데이트

```bash
claude plugin marketplace update kimeloo
claude plugin update visual-decisions@kimeloo
```

`.claude-plugin/plugin.json`의 `version`을 올려야 설치된 PC에 반영된다.

## 개발

```bash
claude plugin validate .
node skills/decision-board/harness/selftest.mjs
```

## 라이선스

Apache License 2.0. [LICENSE](LICENSE)와 [NOTICE](NOTICE)를 참조한다.
