// Runs in the app page before its scripts. Only tells the web app it is inside the desktop shell,
// so it can adapt (no service worker, system-audio capture wording...). No Node APIs are exposed.
'use strict'

const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('sumtalkDesktop', {
  platform: process.platform,
})
