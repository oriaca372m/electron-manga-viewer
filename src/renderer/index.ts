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

interface Point {
	x: number
	y: number
}

interface Rect {
	x: number
	y: number
	width: number
	height: number
}

function renderedRect(
	imgW: number,
	imgH: number,
	viewW: number,
	viewH: number
): Rect & { ratio: number } {
	const wRatio = viewW / imgW
	const hRatio = viewH / imgH
	const ratio = Math.min(wRatio, hRatio)
	const width = ratio * imgW
	const height = ratio * imgH
	return { ratio, width, height, x: (viewW - width) / 2, y: (viewH - height) / 2 }
}

function twoPointToRect(p1: Point, p2: Point): Rect {
	const x = Math.min(p1.x, p2.x)
	const y = Math.min(p1.y, p2.y)
	const width = Math.abs(p1.x - p2.x)
	const height = Math.abs(p1.y - p2.y)
	return { x, y, width, height }
}

class RegionSelector {
	#p1: Point = { x: 0, y: 0 }
	#p2: Point = { x: 0, y: 0 }
	#isEnabled = true

	// とりあえず
	private canvas = document.getElementById('view') as HTMLCanvasElement

	constructor(readonly elm: HTMLDivElement) {}

	setup(): void {
		document.addEventListener('keydown', (e) => {
			if (!this.#isEnabled) {
				return
			}

			console.log(e.code)
			if (e.code === 'Enter') {
				console.log('enter')
				void this.capture()
			}
		})
	}

	#syncElm(): void {
		const rect = twoPointToRect(this.#p1, this.#p2)
		this.elm.style.left = `${rect.x}px`
		this.elm.style.top = `${rect.y}px`
		this.elm.style.width = `${rect.width}px`
		this.elm.style.height = `${rect.height}px`
		this.elm.style.display = this.#isEnabled ? 'block' : 'none'
	}

	enable(): void {
		this.#isEnabled = true
		this.#syncElm()
	}

	disable(): void {
		this.#isEnabled = false
		this.#syncElm()
	}

	toggle(): void {
		this.#isEnabled = !this.#isEnabled
		this.#syncElm()
	}

	onSelectStart(x: number, y: number): void {
		this.#p1 = { x, y }
		this.#p2 = { x, y }
		this.#syncElm()
	}

	onSelect(x: number, y: number): void {
		this.#p2 = { x, y }
		this.#syncElm()
	}

	onSelectEnd(x: number, y: number): void {
		this.onSelect(x, y)
	}

	async capture(): Promise<void> {
		const canvas = this.canvas
		const canvasRect = canvas.getBoundingClientRect()
		const rendered = renderedRect(
			canvas.width,
			canvas.height,
			canvasRect.width,
			canvasRect.height
		)

		const r = 1 / rendered.ratio
		const rect = twoPointToRect(this.#p1, this.#p2)

		const x = (rect.x - rendered.x) * r
		const y = (rect.y - rendered.y) * r
		const w = rect.width * r
		const h = rect.height * r

		const img = new OffscreenCanvas(w, h)
		const ctx = img.getContext('2d')
		if (ctx === null) {
			throw new Error('error')
		}
		ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h)

		this.disable()

		const blob = await img.convertToBlob({ type: 'image/png' })
		await fs.writeFile('test.png', new Uint8Array(await blob.arrayBuffer()))
	}
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

	const regionSelector = new RegionSelector(
		document.getElementById('region-selector') as HTMLDivElement
	)
	regionSelector.setup()

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

		if (e.key === 's') {
			regionSelector.toggle()
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

		if (e.buttons & 2) {
			regionSelector.onSelectStart(rx, ry)
		}
	})

	judge.addEventListener('mouseup', (e) => {
		loupe.off()
		e.preventDefault()

		if (e.buttons & 2) {
			const viewRect = judge.getBoundingClientRect()
			const rx = e.clientX - viewRect.x
			const ry = e.clientY - viewRect.y
			regionSelector.onSelectEnd(rx, ry)
		}
	})

	judge.addEventListener('mousemove', (e) => {
		if (e.buttons & 2) {
			const viewRect = judge.getBoundingClientRect()
			const rx = e.clientX - viewRect.x
			const ry = e.clientY - viewRect.y
			regionSelector.onSelect(rx, ry)
		}
	})
}

document.addEventListener('DOMContentLoaded', () => {
	void main()
})
