import {app} from 'electron';
import electronIsDev from 'electron-is-dev';

import {sendSettingsToRenderer, setCreds} from 'root/app/auth';
import {enableAutoLauncher} from 'root/app/auto_launcher';
import {setupAutoUpdater} from 'root/app/auto_updater';
import {doMtgaPathOps} from 'root/app/do-path-ops';
import {setupIpcMain} from 'root/app/ipc_main';
import {createGlobalLogParser} from 'root/app/log_parser_manager';
import {createMainWindow, withHomeWindow} from 'root/app/main_window';
import {sendMessageToHomeWindow} from 'root/app/messages';
import {setupProcessWatcher} from 'root/app/process_watcher';
import {settingsStore} from 'root/app/settings-store/settings_store';
import {error} from 'root/lib/logger';
import {isMac} from 'root/lib/utils';

// tslint:disable-next-line: no-var-requires no-unsafe-any no-require-imports
require('source-map-support').install();

// tslint:disable-next-line: no-var-requires no-unsafe-any no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit();
}

export const ProcessWatching: {
  processWatcherFn: Function;
  processWatcherFnInterval: number;
  interval: number;
  gameRunningState: boolean;
  pid: number;
} = {
  processWatcherFn: setupProcessWatcher(),
  processWatcherFnInterval: 500,
  interval: 0,
  gameRunningState: true,
  pid: -1,
};

function recreateMainWindow(): void {
  // TODO: doesn't work
  app.setAccessibilitySupportEnabled(false);
  //setupRequestIntercept(app);
  createMainWindow();
  doMtgaPathOps();

  withHomeWindow((w) => {
    if (settingsStore.get().minimized) {
      w.hide();
    } else if (!w.isVisible()) {
      w.once('ready-to-show', () => w.show());
    }
    w.webContents.on('did-finish-load', () => {
      createGlobalLogParser();
      //createGlobalLorParser();
      sendMessageToHomeWindow('set-version', app.getVersion());
      sendMessageToHomeWindow('startup-title', isMac() ? 'Start tracker on system startup' : 'Start with Windows');
      if (electronIsDev) {
        sendMessageToHomeWindow('show-dev-buttons', undefined);
      }
      setCreds('ready-to-show');
      sendSettingsToRenderer();
      ProcessWatching.interval = setInterval(
        ProcessWatching.processWatcherFn,
        ProcessWatching.processWatcherFnInterval
      );
    });
    setupAutoUpdater();
  });
}

app.allowRendererProcessReuse = true;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    withHomeWindow((w) => {
      if (!w.isVisible()) {
        w.show();
      }
      w.focus();
    });
  });

  app.on('ready', recreateMainWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // ONLY FOR MAC
  // app.on('activate', () => {
  //   if (!getMainWindow()) {
  //     recreateMainWindow();
  //   }
  // });
}

if (settingsStore.get().autorun) {
  enableAutoLauncher();
}

setupIpcMain(app);
//setupLorIpcMain(app);

process.on('uncaughtException', (err) => {
  error('Uncaught error in main process', err);
  app.exit();
});
