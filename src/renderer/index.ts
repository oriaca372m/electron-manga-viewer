import { IMangaLoader, ZipMangaLoader, DirectoryMangaLoader } from './manga-loader'
import { MangaFile, MangaView } from './manga'
import { Loupe } from './loupe'
import { genThumbnails, Thumbnails } from './thumbnail'
import { ipcRenderer } from 'electron'
import { promises as fs } from 'fs'
import { resolve } from 'path'

async function loadManga(path: string): Promise<MangaView> {
	let loader: IMangaLoader

	if ((await fs.stat(path)).isDirectory()) {
		loader = new DirectoryMangaLoader(path)
	} else {
		loader = new ZipMangaLoader(path)
	}

	await loader.init()
	const mangaFile = new MangaFile(loader)
	const thumbnails = new Thumbnails(mangaFile)

	const cacheDir = resolve(await ipcRenderer.invoke('get-cache-path'), 'electron-manga-viewer')
	await fs.mkdir(cacheDir, { recursive: true })

	const digest = loader.digest()
	const cachePath = resolve(cacheDir, `${digest}.cache`)
	console.log(cachePath)

	let cached = false

	try {
		cached = (await fs.stat(cachePath)).isFile()
	} catch (e) {
		// pass
	}

	if (cached) {
		// there'is a cache
		console.log('cache found!')
		void thumbnails.loadFromCache(cachePath)
	} else {
		thumbnails.addFinishedLoadHandler(() => {
			void (async () => {
				await thumbnails.writeCache(cachePath)
				console.log('write finished')
			})()
		})
		void thumbnails.load()
	}

	const mangaView = new MangaView(mangaFile, thumbnails)

	await mangaView.moveToPage(0)
	return mangaView
}

async function main() {
	let mangaView: MangaView | undefined
	try {
		const argv = (await ipcRenderer.invoke('get-args')) as string[]
		if (2 < argv.length) {
			mangaView = await loadManga(argv[2])
		}
	} catch (e) {
		console.error(e)
	}

	const loupeElm = document.getElementById('loupe') as HTMLCanvasElement
	const loupe = new Loupe(loupeElm)

	if (mangaView !== undefined) {
		genThumbnails(mangaView)
	}

	const judge = document.getElementById('click-judge') as HTMLDivElement

	document.getElementById('prev')?.addEventListener('click', (e) => {
		loupe.off()
		void mangaView?.prevPage(e.shiftKey)
	})

	document.getElementById('click-judge-right')?.addEventListener('click', (e) => {
		loupe.off()
		void mangaView?.prevPage(e.shiftKey)
	})

	document.getElementById('next')?.addEventListener('click', (e) => {
		loupe.off()
		void mangaView?.nextPage(e.shiftKey)
	})

	document.getElementById('click-judge-left')?.addEventListener('click', (e) => {
		loupe.off()
		void mangaView?.nextPage(e.shiftKey)
	})

	document.addEventListener('keydown', (e) => {
		if (e.code === 'ArrowLeft') {
			void mangaView?.nextPage(e.shiftKey)
		}
		if (e.code === 'ArrowRight') {
			void mangaView?.prevPage(e.shiftKey)
		}
	})

	judge.addEventListener('wheel', (e) => {
		e.preventDefault()
		loupe.off()

		if (e.deltaY < 0) {
			void mangaView?.prevPage(e.shiftKey)
			return
		}

		if (0 < e.deltaY) {
			void mangaView?.nextPage(e.shiftKey)
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

	document.getElementById('thumbnails')?.addEventListener('click', () => {
		const thumbnails = document.getElementById('thumbnails') as HTMLDivElement
		thumbnails.classList.remove('thumbnails-visible')
	})

	document.getElementById('load-file')?.addEventListener('click', () => {
		void (async () => {
			const res = (await ipcRenderer.invoke('open-manga-file-select-dialog')) as string[]
			const path = res[0]
			if (path !== undefined) {
				console.log(path)
				await mangaView?.finalize()
				mangaView = await loadManga(path)
				genThumbnails(mangaView)
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
				await mangaView?.finalize()
				mangaView = await loadManga(path)
				genThumbnails(mangaView)
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
