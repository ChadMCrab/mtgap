import {getMetadata, getUserMetadata} from 'root/api/overlay';
import {registerHotkeys, unRegisterHotkeys} from 'root/app/hotkeys';
import {WindowLocator} from 'root/app/locatewindow';
import {sendMessageToHomeWindow, sendMessageToOverlayWindow} from 'root/app/messages';
import {createOverlayWindow, getOverlayWindow, withOverlayWindow} from 'root/app/overlay_window';
import {settingsStore} from 'root/app/settings-store/settings_store';
import {ProcessWatcher} from 'root/app/watchprocess';
import {error} from 'root/lib/logger';
import {ProcessWatching} from 'root/main';
import {isMac} from 'root/lib/utils';

const movementSensitivity = 5;

const overlayPositioner = new WindowLocator();
const processWatcher = new ProcessWatcher(isMac() ? 'MTGA.app/Contents/MacOS/MTGA' : 'MTGA.exe');

let overlayIsPositioned = false;

export function setupProcessWatcher(): () => void {
  const processWatcherFn = () => {
    processWatcher
      .getprocesses()
      .then((MTGApid) => {
        if (MTGApid === -1) {
          if (ProcessWatching.gameRunningState) {
            ProcessWatching.gameRunningState = false;
            sendMessageToHomeWindow('show-status', {message: 'Game is not running!', color: '#dbb63d'});
            withOverlayWindow((w) => w.hide());
            clearInterval(ProcessWatching.interval);
          }
        } else {
          overlayPositioner.findmtga(MTGApid);
          ProcessWatching.gameRunningState = true;
          const account = settingsStore.getAccount();

          if (account && settingsStore.get().overlay) {
            const ovlSettings = account.overlaySettings;
            let overlayWindow = getOverlayWindow();
            if (!overlayWindow) {
              overlayWindow = createOverlayWindow();

              getMetadata()
                .then((md) => {
                  //console.log(md.allcards);
                  sendMessageToOverlayWindow('set-metadata', md);
                  sendMessageToOverlayWindow('set-ovlsettings', ovlSettings);
                  sendMessageToOverlayWindow('set-icosettings', settingsStore.get().icon);
                })
                .catch((err) => {
                  error('Failure to load Metadata', err);
                });
              getUserMetadata(+account.uid)
                .then((umd) => sendMessageToOverlayWindow('set-userdata', umd))
                .catch((err) => {
                  error('Failure to load User Metadata', err, {...account});
                });
            }

            if (
              overlayPositioner.bounds.width !== 0 &&
              (Math.abs(overlayWindow.getBounds().x - overlayPositioner.bounds.x) > movementSensitivity ||
                Math.abs(overlayWindow.getBounds().y - overlayPositioner.bounds.y) > movementSensitivity ||
                Math.abs(overlayWindow.getBounds().width - overlayPositioner.bounds.width) > movementSensitivity ||
                Math.abs(overlayWindow.getBounds().height - overlayPositioner.bounds.height) > movementSensitivity ||
                !overlayIsPositioned)
            ) {
              if (!overlayWindow.isVisible()) {
                registerHotkeys();
                if (isMac()) {
                  overlayWindow.restore();
                } else {
                  overlayWindow.show();
                }
              }
              const EtalonHeight = 1144;
              const zoomFactor = overlayPositioner.bounds.height / EtalonHeight;
              sendMessageToOverlayWindow('set-zoom', zoomFactor);
              overlayWindow.setBounds(overlayPositioner.bounds);
              overlayIsPositioned = true;
            } else if (
              (overlayPositioner.bounds.width === 0 && (!ovlSettings || !ovlSettings.neverhide)) ||
              !overlayIsPositioned
            ) {
              unRegisterHotkeys();
              overlayWindow.hide();
            } else {
              if (!overlayWindow.isVisible()) {
                registerHotkeys();
                if (isMac()) {
                  overlayWindow.restore();
                } else {
                  overlayWindow.show();
                }
              }
            }

            if (overlayWindow.isVisible()) {
              overlayWindow.setAlwaysOnTop(true, 'screen-saver');
            }
          }
        }
      })
      .catch((_: Error) => {});
  };

  return processWatcherFn;
}
