import { ZipMangaLoader, MangaFile, MangaView } from './manga'
import { Loupe } from './loupe'
import { genThumbnails, Thumbnails } from './thumbnail'

async function main() {
	const loader = new ZipMangaLoader('./test-res/09.zip')
	const mangaFile = new MangaFile(loader)
	await mangaFile.init()

	const thumbnails = new Thumbnails(mangaFile)
	const mangaView = new MangaView(mangaFile, thumbnails)

	await mangaView.moveToPage(0)

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
