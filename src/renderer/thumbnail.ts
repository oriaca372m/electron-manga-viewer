import { MangaView, MangaFile } from './manga'
import { promises as fs } from 'fs'
import { encode, decode } from '@msgpack/msgpack'

export type Size = { width: number; height: number }

export type Thumbnail = {
	originalSize: Size
	image: Uint8Array
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(await blob.arrayBuffer())
}

function uint8ArrayToBlob(array: Uint8Array): Blob {
	return new Blob([array])
}

class Worker {
	private running = false

	constructor(private queue: WorkQueue) {}

	run() {
		if (this.running) {
			return
		}

		this.running = true
		this.runForce()
	}

	private runForce() {
		const work = this.queue.dequeue()
		if (!work) {
			this.running = false
			return
		}

		void work().then(() => {
			this.runForce()
		})
	}

	get isRunning(): boolean {
		return this.running
	}
}

type Work = () => Promise<void>

class WorkQueue {
	works: Work[] = []
	workers: Worker[] = []

	enqueue(work: Work): void {
		this.works.push(work)
		this.workers.forEach((x) => x.run())
	}

	dequeue(): Work | undefined {
		return this.works.shift()
	}

	cancel(): Promise<void> {
		if (this.works.length === 0) {
			return Promise.resolve()
		}

		this.works.splice(0)
		return new Promise((resolve) => {
			const id = window.setInterval(() => {
				if (this.workers.every((x) => !x.isRunning)) {
					window.clearInterval(id)
					resolve()
				}
			}, 50)
		})
	}

	addWorker(): Worker {
		const worker = new Worker(this)
		this.workers.push(worker)
		worker.run()
		return worker
	}
}

export class Thumbnails {
	private loaded = false
	private finishedJobsCount = 0
	private finishedPageLoadHandlers: ((page: number, thumbnail: Thumbnail) => void)[] = []
	private finishedLoadHandlers: (() => void)[] = []
	private data: Thumbnail[] = []
	private readonly _queue = new WorkQueue()

	constructor(private mangaFile: MangaFile) {
		for (let i = 0; i < 4; i++) {
			this._queue.addWorker()
		}
	}

	private async genThumbnailPage(page: number): Promise<Thumbnail> {
		const mangaFile = this.mangaFile

		const canvas = new OffscreenCanvas(300, 300)
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			throw 'コンテキスト取得できない'
		}

		const ni = await mangaFile.getPageImageBitmap(page, false)
		if (ni.height < ni.width) {
			const h = 300 * (ni.height / ni.width)
			canvas.height = h
			ctx.drawImage(ni, 0, 0, ni.width, ni.height, 0, 0, 300, h)
		} else {
			const w = 300 * (ni.width / ni.height)
			canvas.width = w
			ctx.drawImage(ni, 0, 0, ni.width, ni.height, 0, 0, w, 300)
		}
		ni.close()

		const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 85 })
		return {
			originalSize: { width: ni.width, height: ni.height },
			image: await blobToUint8Array(blob),
		}
	}

	load(): Promise<void> {
		const mangaFile = this.mangaFile

		for (let i = 0; i < mangaFile.length; i++) {
			this._queue.enqueue(async () => {
				const thumbnail = await this.genThumbnailPage(i)
				this.finished(i, thumbnail)
			})
		}

		return new Promise((resolve) => {
			this.addFinishedLoadHandler(() => resolve())
		})
	}

	async loadFromCache(path: string): Promise<void> {
		const buf = await fs.readFile(path)
		const decoded = decode(buf) as Thumbnail[]

		for (let i = 0; i < this.mangaFile.length; i++) {
			this.finished(i, decoded[i])
		}
	}

	private finished(page: number, thumbnail: Thumbnail) {
		this.finishedJobsCount++
		console.log(page)
		this.data[page] = thumbnail
		this.finishedPageLoadHandlers.forEach((x) => x(page, thumbnail))

		if (this.finishedJobsCount === this.mangaFile.length) {
			this.loaded = true
			console.log('yatta2')
			this.finishedLoadHandlers.forEach((x) => x())
			this.finishedLoadHandlers = []
		}
	}

	addFinishedLoadHandler(handler: () => void): void {
		if (this.loaded) {
			handler()
		} else {
			this.finishedLoadHandlers.push(handler)
		}
	}

	addFinishedPageLoadHandler(handler: (page: number, thumbnail: Thumbnail) => void): void {
		this.finishedPageLoadHandlers.push(handler)
	}

	getPage(page: number): Thumbnail {
		return this.data[page]
	}

	get isLoaded(): boolean {
		return this.loaded
	}

	async finalize(): Promise<void> {
		await this._queue.cancel()
	}

	async writeCache(path: string): Promise<void> {
		if (!this.isLoaded) {
			throw new Error('Thumbnail generation is not complete!')
		}
		const buf = encode(this.data)
		await fs.writeFile(path, buf)
	}
}

export function genThumbnails(mangaView: MangaView): void {
	const mangaFile = mangaView.mangaFile
	const thumbnails = mangaView.thumbnails
	const thumbnailsElm = document.getElementById('thumbnails-body') as HTMLDivElement
	thumbnailsElm.innerHTML = ''

	const alreadyLoadedThumbnails = []

	const canvases: HTMLCanvasElement[] = []
	for (let i = 0; i < mangaFile.length; i++) {
		const canvas = document.createElement('canvas')
		canvas.width = 300
		canvas.height = 300

		thumbnailsElm?.appendChild(canvas)
		canvas.addEventListener('click', () => {
			void mangaView.moveToPage(i)
		})
		canvases.push(canvas)

		const thumbnail = thumbnails.getPage(i)
		if (thumbnail !== undefined) {
			alreadyLoadedThumbnails.push({ page: i, thumbnail })
		}
	}

	thumbnails.addFinishedPageLoadHandler((page, thumbnail) => {
		void (async () => {
			const canvas = canvases[page]
			const img = await createImageBitmap(uint8ArrayToBlob(thumbnail.image))
			canvas.width = img.width
			canvas.height = img.height
			const br = canvas.getContext('bitmaprenderer')
			br?.transferFromImageBitmap(img)
		})()
	})

	for (const { page, thumbnail } of alreadyLoadedThumbnails) {
		void (async () => {
			const canvas = canvases[page]
			const img = await createImageBitmap(uint8ArrayToBlob(thumbnail.image))
			canvas.width = img.width
			canvas.height = img.height
			const br = canvas.getContext('bitmaprenderer')
			br?.transferFromImageBitmap(img)
		})()
	}
}
