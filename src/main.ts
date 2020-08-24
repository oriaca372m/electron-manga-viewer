import { BrowserWindow, app } from 'electron'

function createWindow() {
	const window = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true
		}
	})

	window.loadFile('./dist/renderer/index.html')
}

async function main() {
	await app.whenReady()
	createWindow()
}

main()
