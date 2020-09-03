import { IMangaLoader, ZipMangaLoader, DirectoryMangaLoader, MangaFile, MangaView } from './manga'
import { Loupe } from './loupe'
import { genThumbnails, Thumbnails } from './thumbnail'
import { remote } from 'electron'
import { promises as fs } from 'fs'

const dialog = remote.dialog

async function loadManga(path: string): Promise<MangaView> {
	let loader: IMangaLoader

	if ((await fs.stat(path)).isDirectory()) {
		loader = new DirectoryMangaLoader(path)
	} else {
		loader = new ZipMangaLoader(path)
	}

	const mangaFile = new MangaFile(loader)
	await mangaFile.init()

	const thumbnails = new Thumbnails(mangaFile)
	const mangaView = new MangaView(mangaFile, thumbnails)

	await mangaView.moveToPage(0)
	return mangaView
}

async function main() {
	let mangaView = await loadManga('./test-res/01.zip')

	const loupeElm = document.getElementById('loupe') as HTMLCanvasElement
	const loupe = new Loupe(loupeElm)

	void genThumbnails(mangaView)

	const judge = document.getElementById('click-judge') as HTMLDivElement

	document.getElementById('prev')?.addEventListener('click', () => {
		loupe.off()
		void mangaView.prevPage()
	})

	document.getElementById('click-judge-right')?.addEventListener('click', () => {
		loupe.off()
		void mangaView.prevPage()
	})

	document.getElementById('next')?.addEventListener('click', () => {
		loupe.off()
		void mangaView.nextPage()
	})

	document.getElementById('click-judge-left')?.addEventListener('click', () => {
		loupe.off()
		void mangaView.nextPage()
	})

	judge.addEventListener('wheel', (e) => {
		e.preventDefault()
		loupe.off()

		if (e.deltaY < 0) {
			void mangaView.prevPage()
			return
		}

		if (0 < e.deltaY) {
			void mangaView.nextPage()
			return
		}
	})

	document.getElementById('show-thumbnails')?.addEventListener('click', () => {
		const thumbnails = document.getElementById('thumbnails') as HTMLDivElement
		thumbnails.classList.toggle('thumbnails-visible')
	})

	document.getElementById('click-judge-center')?.addEventListener('click', () => {
		const thumbnails = document.getElementById('thumbnails') as HTMLDivElement
		thumbnails.classList.toggle('thumbnails-visible')
	})

	document.getElementById('load-file')?.addEventListener('click', () => {
		void (async () => {
			const res = await dialog.showOpenDialog(remote.getCurrentWindow(), {
				properties: ['openFile'],
				title: 'open a file',
				filters: [{ name: 'Zip file', extensions: ['zip'] }],
			})
			const path = res.filePaths[0]
			if (path !== undefined) {
				console.log(path)
				mangaView = await loadManga(path)
				await genThumbnails(mangaView)
			}
		})()
	})

	document.addEventListener('dragover', (e) => {
		e.preventDefault()
	})

	document.addEventListener('drop', (e) => {
		e.preventDefault()
		if (e === null) {
			return
		}

		const path = e.dataTransfer?.files[0]?.path

		void (async () => {
			if (path !== undefined) {
				mangaView = await loadManga(path)
				await genThumbnails(mangaView)
			}
		})()
	})

	judge.addEventListener('mousedown', (e) => {
		loupe.on()
		const viewRect = judge.getBoundingClientRect()
		const rx = e.clientX - viewRect.x
		const ry = e.clientY - viewRect.y
		loupe.drawLoupe(rx, ry)
		e.preventDefault()
	})

	judge.addEventListener('mouseup', (e) => {
		loupe.off()
		e.preventDefault()
	})
}

document.addEventListener('DOMContentLoaded', () => {
	void main()
})
