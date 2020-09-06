const Sentry = require('@sentry/electron');

Sentry.init({dsn: 'https://06ddb4f5bf6c4b589e0624bed18fd441@sentry.io/1894689'});
const { autoUpdater } = require("electron-updater")
const dav = require('dav');
const ipc = require('electron').ipcMain
// Modules to control application life and create native browser window
const { app, protocol, BrowserWindow, crashReporter } = require('electron')
app.commandLine.appendSwitch('--enable-precise-memory-info')
const path = require('path')
const ICalParser = require('cozy-ical').ICalParser;
const base64url = require('base64url');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

 
process.on('uncaughtException', function (err) {
  console.log(err);
})

function createWindow() {    

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        "node-integration": "iframe", 
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
        }
    })

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({responseHeaders: Object.fromEntries(Object.entries(details.responseHeaders).filter(header => !/x-frame-options/i.test(header[0])))});
    });

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')
    mainWindow.setFullScreen(true);
    mainWindow.removeMenu()
    // Open the DevTools.
    if (process.env.DEBUG) {
        mainWindow.webContents.openDevTools()    
    }
    

    mainWindow.webContents.on('crashed', (e) => {        
        mainWindow.destroy();
        createWindow();
    });
    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    autoUpdater.checkForUpdates();
}

 autoUpdater.on('update-downloaded', (info) => {
  autoUpdater.quitAndInstall(true);  
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipc.on('getCalendar', function(event, arg) {

    var xhr = new dav.transport.Basic(
        new dav.Credentials({
            username: arg.user,
            password: arg.password,
        })
    );

    const client = new dav.Client(xhr);
    // No transport arg
    client.createAccount({
            server: arg.server,
        })
        .then(function(account) {
            // account.addressBooks.forEach(function(addressBook) {
            //   console.log('Found address book name ' + addressBook.displayName);
            //   // etc.
            // });
            mainWindow.webContents.send('calendarAccount', {
              account
            })
            dav.syncCaldavAccount(account, { xhr }).then((data) => {

                data.calendars.forEach((calendar, cindex) => {
                    calendar.objects.forEach((object, index) => {
                        parser = new ICalParser();
                        parser.parseString(object.calendarData, function(err, cal) {
                            mainWindow.webContents.send('calendarEvent', {
                                err,
                                event: cal,
                            })
                        });
                    })
                })

            })

        });

})



const isPortReachable = require('is-port-reachable');
 
var isVncLaunched = false; 

setInterval(function(){
    if (isVncLaunched) {
        return false;
    }
    (async () => {
        let reachable = (await isPortReachable(5901, {host: '192.168.88.167'}));
        if (reachable && !isVncLaunched) {
            runViewer();
        }
    })();
}, 2000)



function runViewer()
{
    isVncLaunched = true;
    const { exec } = require('child_process');
    exec('C:\\viewer.exe C:\\conn.vnc', (err, stdout, stderr) => {
      if (err) {
        //some err occurred
        console.error(err)
        isVncLaunched = false;
      } else {
       // the *entire* stdout and stderr (buffered)
       console.log(`stdout: ${stdout}`);
       console.log(`stderr: ${stderr}`);
       isVncLaunched = false;
      }
    });
}


const { MTProto, getSRPParams } = require('@mtproto/core');

const api_id = '987086';
const api_hash = '8fb7bdd115133bf84cfaaf85fa14f061';

var mtproto;



mtproto = new MTProto({
      api_id,
      api_hash,
});

const api = {
  call(method, params, options = {}) {
    return mtproto.call(method, params, options).catch(async error => {
      console.log(`${method} error:`, error);

      const { error_code, error_message } = error;

      if (error_code === 303) {
        const [type, dcId] = error_message.split('_MIGRATE_');

        // If auth.sendCode call on incorrect DC need change default DC, because call auth.signIn on incorrect DC return PHONE_CODE_EXPIRED error
        if (type === 'PHONE') {
          await mtproto.setDefaultDc(+dcId);
        } else {
          options = {
            ...options,
            dcId: +dcId,
          };
        }

        return this.call(method, params, options);
      }

      return Promise.reject(error);
    });
  },
};
// 1. Create an instance
var qrCodeTimer;
ipc.on('initTelegram', function(event, arg) {

        
    getDialogs();
    

    mtproto.updates.on('updateShort', message => {
      console.log(message);      
      if (message._.indexOf('Message') != -1) {
        getDialogs();
      }

      if (message.update._ == 'updateLoginToken') {
        clearInterval(qrCodeTimer);
        mainWindow.webContents.send('telegramQRCodeHide')

        api.call('auth.exportLoginToken', {
            api_id,
            api_hash,
            except_ids: []
        }).then(result => { 
            console.log(result);
        }).catch(e => {
            console.log(e);
            if (e.error_message == 'SESSION_PASSWORD_NEEDED') {
                mainWindow.webContents.send('telegramPassword', {})
            }
        });
      }
    });

})

ipc.on('telegramPassword', function(event, arg) {
    getPassword().then(async result => {
      const { srp_id, current_algo, srp_B } = result;
      const { g, p, salt1, salt2, } = current_algo;

      const { A, M1 } = await getSRPParams({
        g,
        p,
        salt1,
        salt2,
        gB: srp_B,
        password: arg.password,
      });

      return checkPassword({ srp_id, A, M1 })
    }).then((result) => {
        getDialogs();
    }).catch((e) => {
        console.log(e);
        mainWindow.webContents.send('telegramPassword', {})
    })
});

async function checkPassword({ srp_id, A, M1 }) {
  return api.call('auth.checkPassword', {
    password: {
      _: 'inputCheckPasswordSRP',
      srp_id,
      A,
      M1,
    },
  });
}

function getPassword() {
  return api.call('account.getPassword');
}

function createQrCode() {
    api.call('auth.exportLoginToken', {
        api_id,
        api_hash,
        except_ids: []
    }).then(result => {        
        console.log(result);           
        var code = base64url(result.token.buffer)
        mainWindow.webContents.send('telegramQRCode', {            
            code: code,
        })
    }).catch(console.error)
}

function getDialogs() {
    clearInterval(qrCodeTimer);
    mainWindow.webContents.send('telegramQRCodeHide')
    api.call('messages.getDialogs', {
        flags: [],
        exclude_pinned: false,
        folder_id: 0,
        limit: 100,
        offset_peer: {
            _ : 'inputPeerEmpty'
        }

    }).then((result) => {

        let unreadMessages = [];
        let promises = [];
        
        let users = {}
        let channels = {}
        let chats = {}

        result.chats.forEach((chat) => {
            if (chat._ == 'channel') {
                channels[chat.id] = chat
            }
            if (chat._ == 'chat') {
                chats[chat.id] = chat
            }
        })

        result.users.forEach((user) => {
            users[user.id] = user
        })

        result.dialogs.forEach((dialog) => {    
            if (dialog.unread_count > 0 && !dialog.notify_settings.mute_until) {
                console.log(dialog.peer);
                let peer = {};
                let entity = {};
                
                if (dialog.peer._  == 'peerUser') {
                    peer = {
                        _ : 'inputPeerUser',
                        user_id: dialog.peer.user_id,
                        access_hash: users[dialog.peer.user_id].access_hash,
                    }
                    entity = users[dialog.peer.user_id];
                }
                if (dialog.peer._  == 'peerChannel') {
                    peer = {
                        _ : 'inputPeerChannel',
                        channel_id: dialog.peer.channel_id,
                        access_hash: channels[dialog.peer.channel_id].access_hash
                    }
                    entity = channels[dialog.peer.channel_id]
                }
                if (dialog.peer._  == 'peerChat') {
                    peer = {
                        _ : 'inputPeerChat',
                        chat_id: dialog.peer.chat_id
                    }
                    entity = chats[dialog.peer.chat_id]
                }

                promises.push(api.call('messages.getHistory', {
                    peer,
                    limit: dialog.unread_count,
                }).then((result) => {
                    result.entity = Object.assign({}, entity);
                    unreadMessages.push(result);
                }))
            }            
        })
        Promise.all(promises).then((data) => {
            mainWindow.webContents.send('telegramMessages', {            
                messages: unreadMessages,
            })
        })
    }).catch((e) => {        
        if (e.error_message.indexOf('AUTH') != -1) {
            tLogin()    
        }
        console.log(e);
    })
}

function tLogin() {    
    api.call('help.getNearestDc').then(result => {
        console.log(result);    
    });
    createQrCode();
    qrCodeTimer = setInterval(function(){
        createQrCode();
    }, 25000)
}

ipc.on('exit', function(event, args) {
    var cp = require('child_process');    
    var child = cp.spawn('start explorer', [], { detached: true });
    child.unref();
    app.quit()
})