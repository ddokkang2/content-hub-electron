# Content Hub (Windows용 Electron 앱)

YouTube Studio / X / Instagram / Threads / TikTok Studio를 **한 창 안에** 띄우는 콘텐츠 허브.
iframe이 아니라 Electron `webview`로 띄워서, 각 사이트의 `frame-ancestors` 임베드 차단을 받지 않는다.

- 기록 입력 기능 없음. 새 창 열기가 기본이 아님. 모두 앱 안에서 표시.
- 비밀번호 저장 없음. API 없음.
- 로그인은 `persist:content-hub` 파티션의 Chromium 세션에 유지됨. 한 번 로그인하면 앱을 껐다 켜도 유지된다.

## 포함 플랫폼 (기본값 — 사이트 관리에서 변경 가능)

| 플랫폼 | 주소 |
|---|---|
| YouTube Studio | https://studio.youtube.com |
| X | https://x.com/home |
| Instagram | https://www.instagram.com/ |
| Threads | https://www.threads.net/ |
| TikTok Studio | https://www.tiktok.com/tiktokstudio/ |

## v1.1 새 기능 — 사이트 추가/제거 + 창/그리드 조절

### 사이트 N개 추가/제거

상단 **사이트 관리** 버튼을 누르면 모달이 열린다.

- **추가**: 이름 + URL 입력 → **사이트 추가**. URL에 `https://`가 없어도 자동으로 붙는다. 잘못된 URL이면 안내 메시지가 뜬다.
- **수정**: 목록에서 **수정** → 이름/URL을 고친 뒤 **수정 저장**.
- **제거**: 목록에서 **제거**. 기본 5개 포함 어떤 사이트든 지울 수 있지만, 최소 1개는 남아야 한다. 1개만 남았을 때는 제거가 막힌다.
- **기본값으로 복원**: 모달 하단 버튼으로 기본 5개(YouTube Studio / X / Instagram / Threads / TikTok Studio)로 되돌릴 수 있다.
- 추가/수정/제거한 목록은 브라우저 `localStorage`(`content-hub-custom-sites`)에 저장되어 앱을 껐다 켜도 유지된다. 기본 5개는 코드 기본값으로 유지된다.
- 추가한 사이트도 기존 5개와 똑같이 포커스/그리드/리스트/2분할/전체 보기에서 동작하고, 로그인 세션(`persist:content-hub`)을 공유한다.

### 창/그리드 조절

- **포커스 구분선 드래그**: 포커스 뷰에서 큰 패널과 오른쪽 미니 바 사이의 구분선을 마우스로 좌우로 끌면 너비를 조절할 수 있다. 미니 바 최소 300px, 최대 stage 너비의 80%까지.
- **그리드 열 개수**: 그리드 뷰에서 상단에 나타나는 **그리드 열: 2열 / 3열 / 4열** 버튼으로 열 개수를 바꾼다.
- **사이드바 접기/펼치기**: 상단 왼쪽 ☰ 버튼으로 사이드바를 접거나 펼친다.
- 조절값(그리드 열 수, 포커스 미니 바 너비, 사이드바 접힘)은 `localStorage`(`content-hub-layout`)에 저장되어 재시작해도 유지된다.

## v1.2 새 기능 — 프리셋 / 단축키 / 자동 새로고침 / 항상 위에 / 계정 분리 / 빠른 전환 / 스냅샷

### 1. 레이아웃 프리셋

상단 **프리셋 선택** 드롭다운 + **프리셋 저장 / 프리셋 삭제** 버튼.

- 기본 프리셋 3개 (삭제 불가):
  - **작업용**: 포커스 뷰 + YouTube pane 포커스 + 그리드 3열 + 미니 바 300px + 사이드바 펼침
  - **모니터링용**: 그리드 뷰 + 그리드 3열
  - **편집용**: 2분할 뷰 + 그리드 2열 + 미니 바 320px
- 프리셋에는 뷰 모드, 포커스 pane, 그리드 열 수, 미니 바 너비, 사이드바 접힘이 저장된다.
- **프리셋 저장**을 누르면 현재 레이아웃을 이름과 함께 저장한다 (삭제 가능).
- 사용자 프리셋은 `localStorage`(`content-hub-presets`)에 저장되어 재시작해도 유지된다.

### 2. 단축키

| 단축키 | 동작 |
|---|---|
| `Ctrl/Cmd + 1` ~ `9` | 사이드바 순서대로 pane 포커스 전환 |
| `Ctrl/Cmd + B` | 사이드바 접기 / 펼치기 |
| `Ctrl/Cmd + R` 또는 `F5` | 포커스 pane만 새로고침 (브라우저 기본 새로고침 대신 `preventDefault`) |
| `Ctrl/Cmd + K` | 빠른 전환 팝업 열기 |
| `Esc` | 열린 모달 / 팝업 닫기 |

상단 **?** 버튼으로 단축키 도움말 모달을 연다. 입력 필드에 포커스가 있을 때는 단축키가 동작하지 않는다 (Esc 제외).

### 3. 자동 새로고침

상단 **자동 새로고침** 선택: 끄기 / 5분 / 15분 / 30분.

- 선택하면 해당 간격마다 **포커스 pane만** 자동 새로고침한다 (전체가 아님).
- 설정은 `localStorage`(`content-hub-auto-refresh`)에 저장되어 재시작해도 유지된다.
- 켜져 있으면 상단에 `자동 새로고침: N분마다 · 포커스만` 상태가 노란색으로 표시된다.

### 4. 항상 위에

상단 **📌 항상 위에** 토글 버튼. 켜면 창이 다른 창 위에 고정되고, 버튼이 노란색 `ON` 상태가 된다. 설정은 `localStorage`(`content-hub-always-on-top`)에 저장되어 재시작해도 유지된다. `main.js`의 `ipcMain.handle('set-always-on-top')` + `preload.js`의 `hub.setAlwaysOnTop`으로 구현되어 있다.

### 5. 계정별 세션 분리 (계정 관리) — 가장 중요

v1.1까지는 모든 webview가 `persist:content-hub` 하나를 공유했지만, v1.2부터 계정마다 partition이 분리된다.

- **계정 관리** 버튼으로 모달을 연다. 계정 추가(이름 + 색상 라벨), 계정 이름/색상 수정, 계정 제거 가능. 최소 1개 계정 유지, **기본 계정은 삭제 불가**.
- 기본 계정은 v1.1과 같은 `persist:content-hub` 파티션을 그대로 써서 기존 로그인 세션이 유지된다. 그 외 계정은 `persist:content-hub-<accountId>` 파티션을 쓴다 (예: `persist:content-hub-acc-personal`, `persist:content-hub-acc-work`).
- 각 pane 헤더에 **계정 선택 드롭다운**이 있다. 계정을 바꾸면 해당 webview만 새 partition으로 **재생성**한다 (Electron webview는 로드 후 partition 변경이 안 되므로 엘리먼트 교체가 필수). 현재 URL은 유지된 채 새 파티션에서 열린다.
- 같은 사이트를 다른 계정으로 두 번 열 수 있다: 사이트 관리 모달의 각 행에서 계정을 선택하고 **계정으로 열기**를 누르면 별도 pane이 추가된다. pane 식별자는 `플랫폼 + '::' + 계정` (예: `youtube::default`, `youtube::acc-work`).
- 계정 색상 점이 pane 헤더와 사이드바에 표시된다.
- 계정 목록은 `localStorage`(`content-hub-accounts`), pane 구성은 `localStorage`(`content-hub-panes`)에 저장된다.
- 계정을 제거하면 그 계정의 pane은 기본 계정으로 옮겨지며, 같은 사이트의 기본 pane이 이미 있으면 중복 방지를 위해 닫힌다.

### 6. 빠른 전환 (Ctrl/Cmd+K)

`Ctrl/Cmd + K` 또는 상단 **빠른 전환 ⌘K** 버튼을 누르면 검색 팝업이 열린다. 사이트 이름/URL/계정명으로 필터링하고, `↑/↓`로 이동, `Enter`로 해당 pane으로 포커스 이동, `Esc`로 닫는다. 입력 필드에 포커스가 있는 동안에는 `Ctrl/Cmd+K`가 중복 동작하지 않는다.

### 7. 북마크 스냅샷

상단 **📸 스냅샷** 버튼으로 모달을 연다.

- **현재 상태 스냅샷 저장**: 현재 모든 pane의 URL(`webview.getURL()`) + 포커스 + 뷰 + 그리드 설정을 이름과 시간과 함께 저장한다.
- 목록에서 **복원**하면 pane 구성이 스냅샷대로 재구성되고 각 pane이 저장된 URL로 로드된다. 스냅샷에 있던 계정이 현재 목록에 없으면 같은 id로 복원해 파티션을 유지한다.
- **삭제**로 스냅샷을 지울 수 있다.
- 스냅샷은 `localStorage`(`content-hub-snapshots`)에 저장된다.

## 뷰 모드 (기본: 포커스)

- **포커스**: 1개 크게 + 나머지 4개 미니 바
- **그리드**: 5개 타일
- **리스트**: 목록(사이드바) + 선택한 1개 크게
- **2분할**: 포커스 + 그다음 플랫폼
- **전체 보기**: 선택한 1개만 크게

사이드바에서 플랫폼을 클릭하면 포커스가 바뀐다. 각 패널·상단에서 플랫폼별 새로고침 / 전체 새로고침 가능.
“외부 브라우저로 열기”는 폴백용 보조 버튼이다.

## Windows에서 실행 / 빌드

> 이 저장소는 Windows PC에서 실행하는 것을 기준으로 한다.
> 아래 명령은 **Windows의 PowerShell 또는 명령 프롬프트**에서 실행한다.

### 1) Node.js LTS 설치

https://nodejs.org 에서 LTS(장기 지원 버전)를 설치한다.
설치 후 버전 확인:

```powershell
node --version
npm --version
```

### 2) 의존성 설치

프로젝트 폴더에서:

```powershell
cd content-hub-electron
npm install
```

### 3) 실행 (개발 모드)

```powershell
npm start
```

처음 실행하면 5개 패널이 각각 로그인 화면을 보여준다.
각 패널에서 한 번씩 로그인하면, 이후에는 앱을 껐다 켜도 로그인 상태가 유지된다
(`partition="persist:content-hub"` 덕분).

### 4) Windows 설치 파일 만들기 (.exe / NSIS 설치기)

```powershell
npm run dist
```

완료되면 `dist/` 폴더에 설치기(`Content Hub Setup ... .exe`)가 생긴다.
설치기 없이 폴더만 뽑고 싶으면:

```powershell
npm run pack
```

## 로그인이 안 유지될 때

1. 앱을 완전히 종료하고 다시 실행한다.
2. 해당 패널에서 다시 로그인한다 (2단계 인증까지 완료).
3. 회사/학교 PC에서 프로필이 초기화되는 경우(로밍 프로필·보안 프로그램)에는 세션이 지워질 수 있다.
   그럴 땐 `persist:content-hub` 파티션이 유지되는 개인 PC에서 쓰는 것을 권장한다.
4. 그래도 특정 사이트만 안 뜨면 해당 패널의 **“외부 브라우저로 열기”** 폴백을 쓴다.

## 문제 해결 (Windows에서 실제로 만난 케이스)

### PowerShell에서 `npm`이 막힐 때

```
npm : 이 시스템에서 스크립트를 실행할 수 없으므로 ... npm.ps1 파일을 로드할 수 없습니다.
```

PowerShell 실행 정책 때문이다. 같은 창에서 한 번만 풀거나, `npm.cmd`를 쓴다:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm.cmd install
npm.cmd start
```

또는 `cmd`에서 실행하면 이 제한이 없다.

### `GPU process isn't usable` 로 앱이 안 뜰 때

`main.js`에 이미 GPU 비활성화가 들어있다 (`disable-gpu`, `disable-gpu-sandbox`, `no-sandbox`, `in-process-gpu`).
그래도 안 뜨면 PowerShell에서 이렇게 실행:

```powershell
$env:ELECTRON_DISABLE_GPU=1; $env:ELECTRON_DISABLE_SANDBOX=1; npm.cmd start -- --no-sandbox --in-process-gpu --disable-gpu --disable-gpu-sandbox
```

또는 `run.bat` 더블클릭 (위와 같은 명령을 실행한다).
여전히 안 뜨면 `Microsoft Visual C++ Redistributable x64` 최신 버전을 설치해본다 (`exit_code=-1073741515`는 DLL 누락인 경우가 많다).

### 창이 하얗게 비어 있을 때

1. `Ctrl + Shift + I` → Console 탭의 빨간 오류 확인
2. `Ctrl + R` 새로고침 후 10~15초 대기 (5개 webview가 한 번에 로딩되며 멈춘 것처럼 보일 수 있음)
3. `index.html`을 브라우저로 직접 열어 상단바가 보이는지 확인

## 다른 사용자에게 전달하기

소스 zip + `npm install` 방식은 권장하지 않는다 (Node 설치·PowerShell 정책·GPU 문제까지 직접 해결해야 함).
`npm run dist`로 만든 설치 파일 1개로 전달하는 것이 가장 편하다:

```powershell
npm.cmd run dist
```

- `dist/`에 NSIS 설치기(`Content Hub Setup ... .exe`)가 생긴다. 이 파일 1개만 주면 된다.
- 설치 없이 바로 실행하는 포터블이 필요하면:

```powershell
npm.cmd run dist:portable
```

- 코드 서명이 없어서 첫 실행 시 “Windows에서 PC를 보호했습니다”가 뜰 수 있다. `자세한 정보` → `실행`을 누르면 된다.
- 로그인 정보는 각자 PC에 저장된다. 내 계정이 같이 넘어가지 않는다.

순수 웹페이지의 `iframe`은 각 사이트의 `X-Frame-Options` / `CSP frame-ancestors`에 막혀 관리 대시보드를 띄울 수 없다.
Electron `webview`는 최상위 웹 콘텐츠라 이 차단을 받지 않고, 로그인 쿠키도 파티션 단위로 유지된다.

## 파일 구조

```
content-hub-electron/
  package.json   # electron / electron-builder, scripts
  main.js        # BrowserWindow, webviewTag, new-window 처리, 메뉴 최소화 + 항상 위에 ipc
  preload.js     # 외부 열기 + 항상 위에 최소 API만 노출
  index.html     # 상단 뷰 전환 + 사이드바 + 사이트 관리 모달 + 그리드 열 선택 + 프리셋/자동 새로고침/항상 위에/계정/스냅샷/빠른 전환/도움말 UI (pane은 JS가 동적 생성)
  styles.css     # 포커스/그리드/리스트/2분할/전체 보기 + 모달/구분선/사이드바 접힘 + v1.2 UI 레이아웃
  renderer.js    # 뷰 전환, 포커스 선택, 새로고침, webview 이벤트 + 사이트 CRUD + 레이아웃 조절 + v1.2 7개 기능
  run.bat        # GPU 문제 있는 PC용 실행 스크립트 (개발용)
```

## 주의

- 이 앱은 사용자의 로그인 세션을 이용해 각 사이트를 표시할 뿐, 비밀번호를 저장하거나 API로 데이터를 가져오지 않는다.
- 각 사이트의 이용약관·보안 정책은 그대로 적용된다. 비정상적인 자동화·우회는 하지 않는다.
