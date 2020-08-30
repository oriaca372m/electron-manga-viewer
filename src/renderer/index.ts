import { MangaFile, MangaView } from './manga'
import { Loupe } from './loupe'

function genThumbnails(mangaView: MangaView) {
	const mangaFile = mangaView.mangaFile

	const thumbnails = document.getElementById('thumbnails-body')
	const setThumbnail = async (page: number, canvas: HTMLCanvasElement) => {
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
	}

	for (let i = 0; i < mangaFile.length; i++) {
		const canvas = document.createElement('canvas')
		canvas.height = 300
		canvas.width = 300
		thumbnails?.appendChild(canvas)

		canvas.addEventListener('click', () => {
			void mangaView.moveToPage(i)
		})
		void setThumbnail(i, canvas)
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

	judge.addEventListener('mousedown', (e) => {
		loupe.on()
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
