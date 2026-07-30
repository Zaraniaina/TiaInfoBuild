const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')

const { initDatabase } = require('./models/init')
const { handleLogin } = require('./controllers/authController')

function createWindow() {
  // Supprimer le menu par défaut (File, Edit, etc.)
  Menu.setApplicationMenu(null)
  
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Ouvrir la fenêtre en plein écran / grand angle par défaut
  win.maximize()

  win.loadFile('views/index.html')
}

// Quand Electron est prêt, on crée la fenêtre et init DB
app.whenReady().then(() => {
  initDatabase()
  
  ipcMain.handle('auth:login', handleLogin)
  
  createWindow()

  app.on('activate', () => {
    // Sur macOS, on recrée une fenêtre si l'app est relancée sans fenêtre ouverte
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Ferme l'app quand toutes les fenêtres sont fermées (sauf sur macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})