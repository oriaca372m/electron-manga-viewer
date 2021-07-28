import { IMangaLoader, ZipMangaLoader, DirectoryMangaLoader } from './manga-loader'
import { MangaFile, MangaView } from './manga'
import { Loupe } from './loupe'
import { Capture } from './capture'
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

	const capture = new Capture(document.getElementById('region-selector') as HTMLDivElement)
	capture.setup()

	const loupeElm = document.getElementById('loupe') as HTMLCanvasElement
	const loupe = new Loupe(loupeElm, capture)

	if (mangaView !== undefined) {
		genThumbnails(mangaView)
	}

	const judge = document.getElementById('click-judge') as HTMLDivElement

	const turnPage = (shiftKey: boolean, direction: 'next' | 'prev') => {
		loupe.off()

		if (capture.isEnabled) {
			return
		}

		if (direction === 'next') {
			void mangaView?.nextPage(shiftKey)
		} else {
			void mangaView?.prevPage(shiftKey)
		}
	}

	document.getElementById('prev')?.addEventListener('click', (e) => {
		turnPage(e.shiftKey, 'prev')
	})

	document.getElementById('click-judge-right')?.addEventListener('click', (e) => {
		turnPage(e.shiftKey, 'prev')
	})

	document.getElementById('next')?.addEventListener('click', (e) => {
		turnPage(e.shiftKey, 'next')
	})

	document.getElementById('click-judge-left')?.addEventListener('click', (e) => {
		turnPage(e.shiftKey, 'next')
	})

	document.addEventListener('keydown', (e) => {
		if (e.code === 'ArrowLeft') {
			void mangaView?.nextPage(e.shiftKey)
		}
		if (e.code === 'ArrowRight') {
			void mangaView?.prevPage(e.shiftKey)
		}

		if (e.key === 's') {
			capture.toggle()
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
		if (capture.isEnabled) {
			return
		}

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
		e.preventDefault()
		const viewRect = judge.getBoundingClientRect()
		const rx = e.clientX - viewRect.x
		const ry = e.clientY - viewRect.y

		if (capture.isEnabled) {
			console.log(e.button)
			if (e.button === 0) {
				capture.onSelectStart(rx, ry)
			} else {
				loupe.on()
			}
		} else {
			loupe.on()
		}
		loupe.drawLoupe(rx, ry)
	})

	judge.addEventListener('mouseup', (e) => {
		e.preventDefault()

		if (capture.isEnabled && e.button === 0) {
			const viewRect = judge.getBoundingClientRect()
			const rx = e.clientX - viewRect.x
			const ry = e.clientY - viewRect.y
			capture.onSelectEnd(rx, ry)
		} else {
			loupe.off()
		}
	})

	judge.addEventListener('mousemove', (e) => {
		if (capture.isEnabled && (e.buttons & 1) !== 0) {
			const viewRect = judge.getBoundingClientRect()
			const rx = e.clientX - viewRect.x
			const ry = e.clientY - viewRect.y
			capture.onSelect(rx, ry)
		}
	})
}

document.addEventListener('DOMContentLoaded', () => {
	void main()
})
