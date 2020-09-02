import JSZip from 'jszip'
import { promises as fs } from 'fs'
import { Thumbnails } from './thumbnail'

type FinishHandler = (bitmap: ImageBitmap) => void

class Fetching {
	private handlers: FinishHandler[] = []
	private result_: ImageBitmap | undefined

	constructor(private getContetFunc: () => Promise<ImageBitmap>, public lastAccess: number) {}

	async start() {
		this.result_ = await this.getContetFunc()
		for (const handler of this.handlers) {
			handler(this.result_)
		}

		this.handlers = []
	}

	addFinishHandler(handler: FinishHandler) {
		if (this.result_) {
			handler(this.result_)
			return
		}

		this.handlers.push(handler)
	}

	get result(): ImageBitmap | undefined {
		return this.result_
	}
}

class CacheManager {
	private cache: (Fetching | undefined)[] = []
	private accessCounter = 0

	constructor(private getContetFunc: (page: number) => Promise<ImageBitmap>) {}

	private getAccessCount(): number {
		return this.accessCounter++
	}

	async getContent(page: number): Promise<ImageBitmap> {
		const content = this.preFetch(page)
		if (content.result) {
			return content.result
		}

		return new Promise((resolve) => {
			content.addFinishHandler(resolve)
		})
	}

	preFetch(page: number): Fetching {
		const content = this.cache[page]
		if (content === undefined) {
			const fetching = new Fetching(() => this.getContetFunc(page), this.getAccessCount())
			void fetching.start()

			this.cache[page] = fetching

			if (10 < this.cache.filter((x) => x instanceof Fetching).length) {
				this.removeCache(this.findOldestCache())
			}
			return fetching
		}

		content.lastAccess = this.getAccessCount()
		return content
	}

	private findOldestCache(): number {
		let minLastAccess = this.accessCounter + 1
		let oldestIndex = 0
		for (let i = 0; i < this.cache.length; i++) {
			const content = this.cache[i]
			if (content && content.lastAccess < minLastAccess) {
				minLastAccess = content.lastAccess
				oldestIndex = i
			}
		}

		return oldestIndex
	}

	removeCache(page: number) {
		this.cache[page] = undefined
	}
}

export interface IMangaLoader {
	init(): Promise<void>
	getPageImageBitmap(page: number): Promise<ImageBitmap>
	length(): number
}

export class ZipMangaLoader implements IMangaLoader {
	private zip: JSZip = new JSZip()
	private pages: string[] = []

	constructor(private path: string) {}

	async init(): Promise<void> {
		const buf = await fs.readFile(this.path)
		await this.zip.loadAsync(buf)

		this.zip.forEach((path, entry) => {
			if (!entry.dir) {
				this.pages.push(path)
			}
		})
	}

	async getPageImageBitmap(page: number): Promise<ImageBitmap> {
		const imgbuffer = await this.zip.file(this.pages[page])?.async('blob')
		if (!imgbuffer) {
			throw 'invalid page id'
		}

		return await createImageBitmap(imgbuffer)
	}

	length(): number {
		return this.pages.length
	}
}

export class MangaFile {
	private cache: CacheManager

	constructor(private loader: IMangaLoader) {
		this.cache = new CacheManager((page) => this.loader.getPageImageBitmap(page))
	}

	async init(): Promise<void> {
		await this.loader.init()
	}

	async getPageImageBitmap(page: number, useCache = true): Promise<ImageBitmap> {
		if (useCache) {
			return await createImageBitmap(await this.cache.getContent(page))
		}

		return await this.loader.getPageImageBitmap(page)
	}

	async getSize(page: number): Promise<{ width: number; height: number }> {
		const bitmap = await this.cache.getContent(page)
		return { width: bitmap.width, height: bitmap.height }
	}

	preFetch(page: number): void {
		this.cache.preFetch(page)
	}

	get length(): number {
		return this.loader.length()
	}
}

class PageDrawer {
	constructor(
		private mangaFile: MangaFile,
		private canvas: HTMLCanvasElement,
		private ctx: CanvasRenderingContext2D,
		private page: number
	) {}

	private drawSinglePage(bitmap: ImageBitmap) {
		this.canvas.width = bitmap.width
		this.canvas.height = bitmap.height
		const br = this.canvas.getContext('bitmaprenderer')
		if (br) {
			br.transferFromImageBitmap(bitmap)
			return
		}

		console.log('bitmaprendererが取得できませんでした。2dコンテキストにフォールバックします')
		this.ctx.drawImage(bitmap, 0, 0)
	}

	private drawMultiPage(bitmap1: ImageBitmap, bitmap2: ImageBitmap) {
		this.canvas.width = bitmap1.width + bitmap2.width
		this.canvas.height = Math.max(bitmap1.height, bitmap2.height)

		this.ctx.drawImage(bitmap1, 0, (this.canvas.height - bitmap1.height) / 2)
		this.ctx.drawImage(bitmap2, bitmap1.width, (this.canvas.height - bitmap2.height) / 2)
	}

	async draw(multiPaged: boolean): Promise<void> {
		console.log(`starting draw... page: ${this.page}`)

		const bitmap = await this.mangaFile.getPageImageBitmap(this.page)

		if (multiPaged) {
			const bitmap2 = await this.mangaFile.getPageImageBitmap(this.page + 1)

			console.log(`finished draw in multi page: ${this.page}`)
			this.drawMultiPage(bitmap2, bitmap)
			return
		}

		console.log(`finished draw in single page: ${this.page}`)
		this.drawSinglePage(bitmap)
	}
}

export class MangaView {
	private currentPage_: number | undefined
	private isCurrentlyMultipaged = false
	private canvas: HTMLCanvasElement
	private ctx: CanvasRenderingContext2D
	private pageDrawer: PageDrawer | undefined
	private drawedPage: number | undefined

	constructor(private mangaFile_: MangaFile, private thumbnails_: Thumbnails) {
		this.canvas = document.getElementById('view') as HTMLCanvasElement
		const ctx = this.canvas.getContext('2d')
		if (!ctx) {
			throw new Error('canvasのコンテキストが取得できませんでした')
		}
		this.ctx = ctx
	}

	async refreshPage(): Promise<void> {
		const cpage = this.currentPage
		if (cpage === undefined || this.pageDrawer !== undefined || cpage === this.drawedPage) {
			return
		}

		this.pageDrawer = new PageDrawer(this.mangaFile, this.canvas, this.ctx, cpage)
		const multiPaged = await this.shouldDrawInMultiPage(cpage)
		this.isCurrentlyMultipaged = multiPaged

		await this.pageDrawer.draw(multiPaged)
		this.pageDrawer = undefined
		this.drawedPage = cpage

		void this.refreshPage()
	}

	async moveToPage(page: number): Promise<void> {
		if (page < 0 || this.mangaFile.length <= page) {
			throw new Error('無効なページ番号')
		}

		if (this.currentPage_ === page) {
			return
		}

		this.currentPage_ = page
		this.preFetchRange(page - 2, page + 5)
		await this.refreshPage()
	}

	private preFetchRange(from: number, to: number) {
		to = Math.min(this.mangaFile.length, to)
		for (let i = Math.max(0, from); i < to; i++) {
			this.mangaFile.preFetch(i)
		}
	}

	private async shouldDrawInMultiPage(page: number) {
		const p1 = await this.mangaFile.getSize(page)
		if (p1.width < p1.height && page + 1 < this.mangaFile.length) {
			const p2 = await this.mangaFile.getSize(page + 1)
			if (p2.width < p2.height) {
				return true
			}
		}

		return false
	}

	async nextPage(): Promise<void> {
		const movePage = this.isCurrentlyMultipaged ? 2 : 1
		await this.moveToPage(
			Math.min(
				this.mangaFile.length - 1,
				this.currentPage_ === undefined ? 0 : this.currentPage_ + movePage
			)
		)
	}

	async prevPage(): Promise<void> {
		const page = this.currentPage_
		if (!page) {
			await this.moveToPage(0)
			return
		}

		if (0 <= page - 2 && (await this.shouldDrawInMultiPage(page - 2))) {
			await this.moveToPage(page - 2)
			return
		}

		await this.moveToPage(Math.max(0, page - 1))
	}

	get currentPage(): number | undefined {
		return this.currentPage_
	}

	get mangaFile(): MangaFile {
		return this.mangaFile_
	}

	get thumbnails(): Thumbnails {
		return this.thumbnails_
	}
}
