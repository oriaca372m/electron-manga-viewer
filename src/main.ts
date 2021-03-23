import { BrowserWindow, app, ipcMain, dialog } from 'electron'

function createWindow() {
	return new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	})
}

ipcMain.handle('get-args', () => {
	return process.argv
})

ipcMain.handle('get-cache-path', () => {
	return app.getPath('cache')
})

async function main() {
	await app.whenReady()
	const window = createWindow()

	ipcMain.handle('open-manga-file-select-dialog', async () => {
		const res = await dialog.showOpenDialog(window, {
			properties: ['openFile'],
			title: 'open a file',
			filters: [{ name: 'Zip file', extensions: ['zip'] }],
		})

		return res.filePaths
	})

	await window.loadFile('./dist/renderer/index.html')
}

void main()
