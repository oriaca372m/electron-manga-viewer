import { MangaFile, MangaView } from './manga'
import { Loupe } from './loupe'

async function genThumbnails(mangaView: MangaView) {
	const mangaFile = mangaView.mangaFile

	const thumbnails = document.getElementById('thumbnails-body')
	const setThumbnail = (async (page: number, canvas: HTMLCanvasElement) => {
		const ni = await mangaFile.getPageImageBitmap(page, false)
		const ctx = canvas.getContext('2d')

		if (ni.height < ni.width) {
			const h = 300 * (ni.height / ni.width)
			canvas.height = h
			ctx?.drawImage(ni, 0, 0, ni.width, ni.height, 0, 0, 300, h)
		} else {
			const w = 300 * (ni.width / ni.height)
			canvas.width = w
			ctx?.drawImage(ni, 0, 0, ni.width, ni.height, 0, 0, w, 300)
		}
		ni.close()
		canvas.scrollIntoView()
	})

	for (let i = 0; i < mangaFile.length; i++) {
		const canvas = document.createElement('canvas') as HTMLCanvasElement
		canvas.height = 300
		canvas.width = 300
		thumbnails?.appendChild(canvas)

		canvas.addEventListener('click', () => {
			mangaView.moveToPage(i)
		})
		setThumbnail(i, canvas)
	}
}

async function main() {
	const mangaFile = new MangaFile('./test-res/01s.zip')
	await mangaFile.init()
	const mangaView = new MangaView(mangaFile)

	await mangaView.moveToPage(0)

	const loupeElm = document.getElementById('loupe') as HTMLCanvasElement
	const loupe = new Loupe(loupeElm)

	genThumbnails(mangaView)

	document.getElementById('prev')?.addEventListener('click', async () => {
		loupe.off()
		await mangaView.prevPage()
	})

	document.getElementById('next')?.addEventListener('click', async () => {
		loupe.off()
		await mangaView.nextPage()
	})

	document.getElementById('view')?.addEventListener('wheel', async (e) => {
		e.preventDefault()
		loupe.off()

		if (e.deltaY < 0) {
			await mangaView.prevPage()
			return
		}

		if (0 < e.deltaY) {
			await mangaView.nextPage()
			return
		}
	})

	document.getElementById('show-thumbnails')?.addEventListener('click', () => {
		const thumbnails = document.getElementById('thumbnails')!
		thumbnails.classList.toggle('thumbnails-visible')
	})

	const canvas = document.getElementById('view') as HTMLCanvasElement

	canvas.addEventListener('mousedown', e => {
		loupe.on()
		e.preventDefault()
	})

	canvas.addEventListener('mouseup', e => {
		loupe.off()
		e.preventDefault()
	})
}

document.addEventListener('DOMContentLoaded', () => {
	main()
})
