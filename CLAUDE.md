# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

브라우저용 팀 FPS입니다. 클라이언트는 React + three.js, 서버는 Node WebSocket이고 전부 TypeScript입니다. 게임 UI 문구는 한국어입니다.

## 명령어

```bash
npm run dev        # node server.ts --dev — 게임 서버 + Vite 미들웨어(HMR)를 한 포트에서 실행, http://localhost:3000
npm run build      # tsc(strict 타입 검사) && vite build → dist/
npm start          # node server.ts — dist/ + 게임 서버 제공, dist/가 없으면 게임 서버만 실행
npm run typecheck  # tsc만 실행(noEmit)
npm test           # node test.ts — assert 기반 단일 스크립트, 테스트 러너가 없어 테스트를 골라 실행할 수 없음
```

- 포트는 `PORT` 환경변수로 바꿉니다(3000이 사용 중이면 `PORT=3001 npm run dev`).
- `npm start`는 마지막 빌드를 보여 줍니다. 클라이언트를 고쳤으면 `npm run build`, `server.ts`나 `shared/`를 고쳤으면 서버를 재시작해야 합니다(공유 데이터는 서버 시작 시 한 번만 읽음).
- 서버는 Node 22.18 이상에서 `.ts`를 빌드 없이 바로 실행합니다(type stripping). 그래서 tsconfig로 다음을 강제합니다.
  - `erasableSyntaxOnly`: `enum`, namespace, 생성자 매개변수 프로퍼티 금지
  - `verbatimModuleSyntax`: 타입만 가져올 때는 `import type`
  - 상대 경로 import에 `.ts`/`.tsx` 확장자를 붙임

## 구조

세 부분으로 나뉘고, `shared/`는 서버와 클라이언트가 함께 import하므로 게임 규칙과 지형이 양쪽에서 똑같습니다.

- **`shared/protocol.ts`**: WebSocket 메시지 전체(`ServerMsg`, `ClientMsg` 유니온)를 정의합니다. 메시지 종류를 추가하면 서버의 `handlers`(`server.ts`)와 클라이언트의 `on`(`src/game/session.ts`)도 고쳐야 합니다. 둘 다 타입으로 묶여 있어 빠진 곳을 컴파일러가 알려 줍니다.
- **`shared/weapons.ts`**: `WeaponKind`별 무기 수치입니다. 무기를 추가하면 다음도 함께 필요합니다. 모두 `Record<WeaponKind, …>`라 tsc가 강제합니다.
  - `src/game/models.ts`의 `GUNS`에 모델
  - `src/game/sound.ts`의 `SOUNDS.shot`과 `SHOT_VOLUME`에 소리
- **`shared/map.ts`, `shared/town.ts`, `shared/maps.ts`**: 맵 데이터입니다.
  - **상자 목록:** 맵은 축 정렬 상자 `[minX,minY,minZ,maxX,maxY,maxZ,material]`의 목록이고, 충돌과 히트스캔(`rayAABB`, `rayPlayer`)에 같이 쓰입니다.
  - **`GameMap`:** 출발 지점, `loadout`(`'all'` = 모든 무기로 시작, `'pickup'` = 권총으로 시작하고 주워서 최대 `MAX_CARRY`자루), `doors`, `pickups`, `lamps`를 더한 타입입니다.
  - **`solids(map, doorsOpen)`:** 벽 + 닫힌 문을 돌려줍니다. 서버와 클라이언트 모두 이걸 기준으로 충돌과 사격 판정을 합니다.
  - **대칭:** B팀 쪽 절반은 A팀 쪽을 원점 기준으로 뒤집은 것(`mirror`)입니다.
  - **건물 생성기:** `town.ts`의 `building()`이 문·창문 구멍이 난 벽, 계단 구멍이 난 층 바닥, 계단, 옥상 난간을 만듭니다.
  - **계단 높이 제한:** 클라이언트는 계단을 따로 처리하지 않고 턱을 올라서는 방식이라, 계단 한 칸 높이가 `STEP`(0.45m) 이하여야 합니다. `test.ts`가 이것과 함께 출발 지점, 무기 위치, 계단 앞 설 공간을 검사합니다.

### 서버 (`server.ts`)
- **구성:** 기본 `http`와 `ws`만 씁니다. 게임 통신은 `/ws` 경로이고, 개발 모드에서 Vite HMR과 포트를 같이 쓰도록 업그레이드 요청을 경로로 나눕니다(`noServer`).
- **방·플레이어:** 메모리에만 저장합니다.
- **서버가 판정하는 것:** 명중, 데미지, 탄약·장전·연사 속도, 무기 인벤토리, 문, 줍기입니다. 들어오는 메시지는 `unknown`(`Incoming`)으로 받아 검사 함수로 확인합니다.
- **클라이언트를 믿는 것:** 이동과 탄퍼짐입니다. 코드의 `shortcut:` 주석에 표시되어 있습니다.
- **스냅샷:** 초당 20번 보냅니다.

### 클라이언트 (`src/`)
- **`game/engine.ts`:** `createEngine(els, hooks)`가 three.js 게임 전체이고, 렌더 루프 하나로 돌아가는 명령형 코드입니다.
  - **입력과 이동:** 포인터 잠금, 키 입력(WASD, Shift, C, R, F, 숫자), 이동과 상자 충돌, 턱 오르기를 처리합니다.
  - **사격:** 반동과 조준(ADS)을 처리합니다.
  - **1인칭 총(viewmodel):** 별도의 `viewScene`에 두고 깊이 버퍼를 지운 뒤 그려서 벽에 파묻히지 않습니다.
  - **월드:** 다른 플레이어, 문, 떨어진 무기를 그립니다.
  - **매 프레임 바뀌는 화면 요소:** 크로스헤어 간격, 히트마커, 데미지 숫자, 피격 방향, F 안내는 성능 때문에 React를 거치지 않고 DOM을 직접 바꿉니다.
  - **바깥과의 연결:** `Engine` API로 조작받고 `EngineHooks`로 결과를 알립니다.
- **`game/session.ts`:** WebSocket 클라이언트입니다. `ServerMsg`를 엔진과 store로 나눠 보내고, 컴포넌트는 `actions`를 호출합니다. 클라이언트를 따로 호스팅할 때(예: Vercel)는 빌드 시 `VITE_WS_URL`로 서버 주소를 지정합니다.
- **`store.ts`:** 앱 상태 객체 하나를 `useStore(selector)`(`useSyncExternalStore`)로 읽습니다. `mode`는 `range | lobby | room | game`입니다. selector는 새 객체를 만들지 말고 기존 참조를 돌려줘야 합니다.
- **`components/`:** 캔버스 주위의 React UI(사격장 패널, 대기실, 방, HUD)입니다. `GameView`가 엔진을 한 번만 띄웁니다. StrictMode는 WebGL 장면을 두 번 만들기 때문에 쓰지 않습니다.
- **`game/models.ts`:** 화면에 보이는 것은 전부 코드로 생성합니다.
  - **텍스처:** 캔버스에 그립니다.
  - **지형 소품:** `levelBox()`가 충돌 상자를 재질별 상세 모델(자동차, 방벽, 모래주머니, 컨테이너 등)로 바꿉니다.
  - **총:** 총구는 −z 방향이고 원점은 리시버 뒤쪽입니다. `grip`/`fore`/`sight`/`butt`가 손 IK와 조준 위치를 정합니다.
  - **병사:** 관절로 움직이고, 팔은 두 마디 IK로 총을 잡습니다.
  - **주의:** 보이는 모양은 충돌 상자와 다를 수 있습니다. 충돌은 항상 상자 기준입니다.
- **`game/sound.ts`:** 모든 소리를 로드 시 AudioBuffer로 합성합니다(오디오 파일 없음). 다른 플레이어의 총소리는 3D로 들립니다.

이미지·오디오·3D 모델 파일은 없고, 글꼴만 Google Fonts에서 받아옵니다.

## 작업 규칙
- 응답은 한국어로 작성합니다.
- **브랜치:** 브랜치를 만들지 않고 `main`에서 바로 작업하고 커밋합니다.
- **커밋 메시지:** gitmoji + 타입 + 한국어 요약입니다. 예: `✨ feat: …`, `🐛 fix: …`, `💄 style: …`, `⚖️ balance: …`
- **알려진 한계:** 코드에 `shortcut: <한계>, <개선 시점>` 형식의 주석으로 남깁니다.