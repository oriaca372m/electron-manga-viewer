import { MangaView, MangaFile } from './manga'

export type Size = { width: number; height: number }

export type Thumbnail = {
	originalSize: Size
	image: ImageBitmap
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

	constructor(private mangaFile: MangaFile) {
		this.addFinishedPageLoadHandler((page, thumbnail) => this.finished(page, thumbnail))
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

		return {
			originalSize: { width: ni.width, height: ni.height },
			image: await createImageBitmap(canvas),
		}
	}

	load(): Promise<void> {
		const mangaFile = this.mangaFile
		const queue = new WorkQueue()

		queue.addWorker()
		queue.addWorker()
		queue.addWorker()
		queue.addWorker()

		for (let i = 0; i < mangaFile.length; i++) {
			queue.enqueue(async () => {
				const thumbnail = await this.genThumbnailPage(i)
				this.finishedPageLoadHandlers.forEach((x) => x(i, thumbnail))
			})
		}

		return new Promise((resolve) => {
			this.addFinishedLoadHandler(() => resolve())
		})
	}

	private finished(page: number, thumbnail: Thumbnail) {
		this.finishedJobsCount++
		console.log(page)
		this.data[page] = thumbnail

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
}

export async function genThumbnails(mangaView: MangaView): Promise<void> {
	const mangaFile = mangaView.mangaFile
	const thumbnails = mangaView.thumbnails
	const thumbnailsElm = document.getElementById('thumbnails-body') as HTMLDivElement
	thumbnailsElm.innerHTML = ''

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
	}

	thumbnails.addFinishedPageLoadHandler((page, thumbnail) => {
		void (async () => {
			const canvas = canvases[page]
			const img = await createImageBitmap(thumbnail.image)
			canvas.width = img.width
			canvas.height = img.height
			const br = canvas.getContext('bitmaprenderer')
			br?.transferFromImageBitmap(img)
		})()
	})

	await thumbnails.load()
}
