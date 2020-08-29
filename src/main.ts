import { BrowserWindow, app } from 'electron'

async function createWindow() {
	const window = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true,
		},
	})

	await window.loadFile('./dist/renderer/index.html')
}

async function main() {
	await app.whenReady()
	await createWindow()
}

void main()
