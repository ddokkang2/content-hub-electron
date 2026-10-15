# Content Hub (Windows용 Electron 앱)

YouTube Studio / X / Instagram / Threads / TikTok Studio를 **한 창 안에** 띄우는 콘텐츠 허브.
iframe이 아니라 Electron `webview`로 띄워서, 각 사이트의 `frame-ancestors` 임베드 차단을 받지 않는다.

- 기록 입력 기능 없음. 새 창 열기가 기본이 아님. 모두 앱 안에서 표시.
- 비밀번호 저장 없음. API 없음.
- 로그인은 `persist:content-hub` 파티션의 Chromium 세션에 유지됨. 한 번 로그인하면 앱을 껐다 켜도 유지된다.

## 포함 플랫폼

| 플랫폼 | 주소 |
|---|---|
| YouTube Studio | https://studio.youtube.com |
| X | https://x.com/home |
| Instagram | https://www.instagram.com/ |
| Threads | https://www.threads.net/ |
| TikTok Studio | https://www.tiktok.com/tiktokstudio/ |

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
  main.js        # BrowserWindow, webviewTag, new-window 처리, 메뉴 최소화
  preload.js     # 외부 열기 최소 API만 노출
  index.html     # 상단 뷰 전환 + 사이드바 + 5개 webview pane
  styles.css     # 포커스/그리드/리스트/2분할/전체 보기 레이아웃
  renderer.js    # 뷰 전환, 포커스 선택, 새로고침, webview 이벤트
  run.bat        # GPU 문제 있는 PC용 실행 스크립트 (개발용)
```

## 주의

- 이 앱은 사용자의 로그인 세션을 이용해 각 사이트를 표시할 뿐, 비밀번호를 저장하거나 API로 데이터를 가져오지 않는다.
- 각 사이트의 이용약관·보안 정책은 그대로 적용된다. 비정상적인 자동화·우회는 하지 않는다.
