import { ZipLoader, ZipEntry } from '@oriaca372m/seekable-unzipper'
import { promises as fs } from 'fs'
import * as path from 'path'
import crypto from 'crypto'

function sha256sum(str: string): string {
	return crypto.createHash('sha256').update(str, 'utf-8').digest('hex')
}

const validFilenamePattern = /\.(png|webp|jpe?g)$/i

export interface IMangaLoader {
	init(): Promise<void>
	finalize(): Promise<void>
	getPageImageBitmap(page: number): Promise<ImageBitmap>
	length(): number
	digest(): string
}

export class ZipMangaLoader implements IMangaLoader {
	private zip!: ZipLoader
	private pages: ZipEntry[] = []

	constructor(private path: string) {}

	async init(): Promise<void> {
		this.zip = await ZipLoader.fromFile(this.path)
		await this.zip.init()

		this.zip.entries
			.filter((x) => validFilenamePattern.test(x.fileName))
			.sort((a, b) => {
				if (a.fileName < b.fileName) {
					return -1
				}

				if (a.fileName > b.fileName) {
					return 1
				}

				return 0
			})
			.forEach((x) => {
				this.pages.push(x)
			})
	}

	async finalize(): Promise<void> {
		await this.zip.finalize()
	}

	async getPageImageBitmap(page: number): Promise<ImageBitmap> {
		const imgbuffer = await this.pages[page]?.getContentBuffer()
		if (!imgbuffer) {
			throw 'invalid page id'
		}

		return await createImageBitmap(new Blob([imgbuffer]))
	}

	length(): number {
		return this.pages.length
	}

	digest(): string {
		return sha256sum(
			JSON.stringify({
				type: 'zip',
				path: path.resolve(this.path),
				length: this.length(),
			})
		)
	}
}

export class DirectoryMangaLoader implements IMangaLoader {
	private pages: string[] = []

	constructor(private path: string) {}

	async init(): Promise<void> {
		const list = await fs.readdir(this.path)
		this.pages = list.filter((x) => validFilenamePattern.test(x)).sort()
		console.log(list)
	}

	finalize(): Promise<void> {
		return Promise.resolve()
	}

	async getPageImageBitmap(page: number): Promise<ImageBitmap> {
		const imgbuffer = await fs.readFile(path.resolve(this.path, this.pages[page]))
		return await createImageBitmap(new Blob([imgbuffer]))
	}

	length(): number {
		return this.pages.length
	}

	digest(): string {
		return sha256sum(
			JSON.stringify({
				type: 'directory',
				path: path.resolve(this.path),
				length: this.length(),
			})
		)
	}
}
