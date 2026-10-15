// Content Hub — main process (Windows)
// webview 기반: iframe이 아니라 최상위 웹뷰라 frame-ancestors 차단을 받지 않음.
// 비밀번호 저장 없음. API 없음. 로그인은 Chromium 세션(persist 파티션)에만 유지됨.

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 진단 로그: 앱이 왜 꺼지는지 파일로 남김 (%TEMP%/content-hub-crash.log)
function diagLog(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(line.trim());
    fs.appendFileSync(path.join(app.getPath('temp'), 'content-hub-crash.log'), line);
  } catch (_) { /* 로그 실패는 무시 */ }
}
process.on('uncaughtException', (e) => diagLog(`UNCAUGHT: ${e && e.stack || e}`));
process.on('unhandledRejection', (e) => diagLog(`UNHANDLED_REJECTION: ${e && e.stack || e}`));
app.on('render-process-gone', (_e, wc, details) => diagLog(`RENDER_GONE: reason=${details && details.reason} exitCode=${details && details.exitCode}`));

// GPU 문제 있는 윈도우 PC 대응: 하드웨어 가속 끄고 GPU 샌드박스 비활성화
// (GPU process exited unexpectedly / GPU process isn't usable / GLES3 context 생성 실패 회피)
// 이 PC에서는 ANGLE/GLES 컨텍스트 생성 자체가 FATAL이라 SwiftShader 소프트웨어 렌더링 강제
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor,UseSkiaRenderer');

let mainWindow = null;
let alwaysOnTopDesired = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Content Hub',
    autoHideMenuBar: true,
    alwaysOnTop: alwaysOnTopDesired,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // webview 태그 허용 (핵심)
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  diagLog('WINDOW_CREATED: loadFile called');

  mainWindow.webContents.on('crashed', (_e, killed) => diagLog(`WEBCONTENTS_CRASHED: killed=${killed}`));
  mainWindow.webContents.on('render-process-gone', (_e, details) => diagLog(`WEBCONTENTS_GONE: ${JSON.stringify(details)}`));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => diagLog(`DID_FAIL_LOAD: code=${code} desc=${desc} url=${url}`));

  // 앱 안에서 새 창이 뜨는 경우: 외부 브라우저로 보내서 허브 창을 깨지 않음.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// renderer의 "외부 브라우저로 열기" 폴백 버튼용
ipcMain.handle('open-external', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// v1.2 항상 위에: renderer 토글 → mainWindow.setAlwaysOnTop
// app.whenReady 이전에 등록해야 renderer가 언제 호출해도 준비됨.
// 창이 아직 없을 때 호출되면 desired 값만 저장하고, 창 생성 시 적용한다.
ipcMain.handle('set-always-on-top', (_event, enabled) => {
  alwaysOnTopDesired = Boolean(enabled);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(alwaysOnTopDesired);
  }
  return alwaysOnTopDesired;
});

app.whenReady().then(() => {
  // 메뉴 최소화 (기본 메뉴 숨김)
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  diagLog('WINDOW_ALL_CLOSED: quitting');
  if (process.platform !== 'darwin') app.quit();
});
