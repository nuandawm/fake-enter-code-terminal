const {app, BrowserWindow, ipcMain} = require('electron');
const url = require("url");
const path = require("path");
const fs = require('fs');
const dataurl = require('dataurl');

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    },
    fullscreen: true
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, `/dist/index.html`),
      protocol: "file:",
      slashes: true
    })
  );
  // Open the DevTools.
  //mainWindow.webContents.openDevTools()

  mainWindow.on('closed', function () {
    mainWindow = null
  });

  /*const filePath = 'Sad_Trombone-Joe_Lamb-665429450.mp3';
  const failSoundFile = new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) { reject(err); }
      resolve(dataurl.convert({ data, mimetype: 'audio/mp3' }));
    });
  });*/
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});

app.on('activate', function () {
  if (mainWindow === null) createWindow()
});

ipcMain.on('quit-app', function () {
  app.quit()
});
