# Hard Fearless Draft OS

리그 오브 레전드 하드 피어리스(Hard Fearless) 드래프트 운영 시스템입니다. 스크림 및 공식 경기 데이터를 기반으로 밴픽을 보조하고 상대팀 데이터를 분석하는 차세대 일렉트론(Electron) 데스크톱 애플리케이션입니다.

## 🌟 주요 기능

*   **하드 피어리스 (Global Fearless) 룰 적용**: 진행된 세트에서 양 팀이 사용한 모든 챔피언을 다음 세트에서 밴 처리.
*   **스크림 및 공식 경기 기록 (Match Log)**: BO3 / BO5 게임의 각 라운드 결과, 밴/픽 타임라인, 요약 정보 기록.
*   **스마트 추천 알고리즘**: 상대방의 픽 선호도(P_enemyPick), 위협도(Threat), 우리 팀 선수의 챔피언 숙련도 및 시그니처, 메타 버프/너프 수치를 통합적으로 계산하여 밴과 픽을 추천.
*   **팀 DNA 및 스카우팅**: 우리 팀 선수들의 숙련도 및 시그니처 픽 관리. 상대팀의 픽 빈도를 추적하여 데이터 기반 밴픽 유도.
*   **패치 메타 실시간 반영**: Riot DDragon 데이터를 비교하여 최신 패치 대비 버프 및 너프 챔피언을 자동 감지하고 추천 점수에 반영.
*   **네이티브 데스크톱 경험**: 커스텀 타이틀바 기반 쾌적한 인터페이스 (설정, 전체 화면 모드, 창 제어 내장).

## 🛠️ 기술 스택

*   **Frontend**: Vanilla HTML / CSS / JavaScript
*   **Backend / DB**: LocalStorage 기반 시스템으로 별도의 백엔드 없이 빠르게 구동
*   **Desktop App**: Electron.js
*   **API**: Riot Games Data Dragon (DDragon)

## 🚀 실행 방법

### 기본 요구사항
*   **Node.js** (v14 이상 권장)
*   **npm**

### 설치 및 실행

1. 레포지토리 클론
\`\`\`bash
git clone <repository-url>
cd lol-draft-assistant
\`\`\`

2. 종속성 패키지 설치
\`\`\`bash
npm install
\`\`\`

3. 애플리케이션 실행
\`\`\`bash
npm start
\`\`\`

## ⚙️ 주요 파일 구조

*   \`main.js\`, \`preload.js\`: 일렉트론 메인 프로세스 및 IPC 브릿지
*   \`index.html\`, \`style.css\`: 프론트엔드 UI 뼈대 구조 및 반응형 커스텀 디자인
*   \`js/draft-engine.js\`: 밴픽 턴 제어 및 시리즈/게임 기록 상태 머신
*   \`js/analysis.js\`: 밴픽 추천 알고리즘 및 점수 산정 엔진
*   \`js/store.js\`: 팀, 상대팀, 선수, 시리즈 매치 기록 보관 로컬 DB 코어
*   \`js/meta-analyzer.js\`: DDragon API 기반 버전별 챔피언 스탯 변화율 감지
*   \`js/scrim-ui.js\`, \`js/team-ui.js\`, \`js/ui.js\`: 각 화면 상태 렌더러

## 📝 라이선스

본 애플리케이션은 라이엇 게임즈의 "Legal Jibber Jabber" 정책을 준수하여 개발되었으며, Riot Games에서 보증하거나 관리하지 않습니다.
