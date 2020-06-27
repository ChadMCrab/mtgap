import {app} from 'electron';

import {getParsingMetadata} from 'root/api/getindicators';
import {parseOldLogs, withLogParser} from 'root/app/log_parser_manager';
import {sendMessageToHomeWindow} from 'root/app/messages';
import {showNotification} from 'root/app/notification';
import {error} from 'root/lib/logger';

export const oldLogHandlerStatus = {
  ReadingOldLogs: false,
  AbortOldLogs: false,
};

export function parseOldLogsHandler(
  logs: string[],
  index: number,
  skipped: number,
  shadow?: boolean,
  dev?: boolean,
  forceUpload?: boolean
): void {
  oldLogHandlerStatus.ReadingOldLogs = true;
  if (!shadow) {
    sendMessageToHomeWindow('show-prompt', {
      message: `Parsing old log: ${index + 1}/${logs.length} (Skipped: ${skipped})`,
      autoclose: 0,
    });
  } else {
    sendMessageToHomeWindow('show-status', {
      message: `Parsing old logs: ${index + 1}/${logs.length} (Skipped: ${skipped})`,
      color: '#22a83a',
    });
  }
  if (oldLogHandlerStatus.AbortOldLogs) {
    sendMessageToHomeWindow('shadow-sync-over', undefined);
    sendMessageToHomeWindow('show-status', {message: 'Parsing aborted!', color: '#22a83a'});
    oldLogHandlerStatus.ReadingOldLogs = false;
    oldLogHandlerStatus.AbortOldLogs = false;
    withLogParser((lp) => lp.start());
    return;
  }
  withLogParser((lp) => lp.stop());
  getParsingMetadata(app.getVersion())
    .then((parsingMetadata) =>
      parseOldLogs(logs[index], parsingMetadata, undefined, dev, forceUpload).then((result) => {
        switch (result) {
          case 0:
          case 1:
            if (index + 1 === logs.length) {
              oldLogHandlerStatus.ReadingOldLogs = false;
              if (!shadow) {
                sendMessageToHomeWindow('show-prompt', {message: 'Parsing complete!', autoclose: 1000});
              } else {
                sendMessageToHomeWindow('show-status', {message: 'Old logs are uploaded!', color: '#22a83a'});
                showNotification('MTGA Pro Tracker', 'All old logs have been parsed!');
                sendMessageToHomeWindow('shadow-sync-over', undefined);
              }
              withLogParser((lp) => lp.start());
            } else {
              parseOldLogsHandler(logs, index + 1, skipped + result, shadow, dev, forceUpload);
            }
            break;
          case 2:
            sendMessageToHomeWindow('show-prompt', {
              message: 'Found new user during old logs parsing! Please handle this account and repeat old logs parsing',
              autoclose: 1000,
            });
            showNotification(
              'MTGA Pro Tracker',
              'Found new user during old logs parsing! Please handle this account and repeat old logs parsing'
            );
            oldLogHandlerStatus.ReadingOldLogs = false;
            sendMessageToHomeWindow('shadow-sync-over', undefined);
            break;
        }
      })
    )
    .catch((err) => {
      error('Error reading old logs', err);
      sendMessageToHomeWindow('shadow-sync-over', undefined);
      oldLogHandlerStatus.ReadingOldLogs = false;
    });
}
