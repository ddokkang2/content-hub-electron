// Content Hub — main process (Windows)
// webview 기반: iframe이 아니라 최상위 웹뷰라 frame-ancestors 차단을 받지 않음.
// 비밀번호 저장 없음. API 없음. 로그인은 Chromium 세션(persist 파티션)에만 유지됨.

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

// GPU 문제 있는 윈도우 PC 대응: 하드웨어 가속 끄고 GPU 샌드박스 비활성화
// (GPU process exited unexpectedly / GPU process isn't usable 오류 회피)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('in-process-gpu');

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
  if (process.platform !== 'darwin') app.quit();
});
