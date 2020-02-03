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
    mainWindow.webContents.openDevTools()

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