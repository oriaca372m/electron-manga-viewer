import fs from 'fs'
import JSZip from 'jszip'

async function drawFile(zip: JSZip, path: string) {
	const imgbuffer = await zip.file(path)?.async('blob')
	if (!imgbuffer) {
		throw 'err2'
	}

	console.log(imgbuffer)
	const ni = await createImageBitmap(imgbuffer)

	const canvas = document.getElementById('view') as HTMLCanvasElement
	const br = canvas.getContext('bitmaprenderer')
	canvas.width = ni.width
	canvas.height = ni.height
	br?.transferFromImageBitmap(ni)
}

function minmax(v: number, min: number, max: number): number {
	if (v < min) {
		return min
	}

	if (v > max) {
		return max
	}

	return v
}

function renderedRect(imgW: number, imgH: number, viewW: number, viewH: number): { x: number, y: number, width: number, height: number, ratio: number } {
	const wRatio = viewW / imgW
	const hRatio = viewH / imgH
	const ratio = Math.min(wRatio, hRatio)
	const width = ratio * imgW
	const height = ratio * imgH
	return { ratio, width, height, x: (viewW - width) / 2, y: (viewH - height) / 2 }
}

async function main() {
	const buf = await fs.promises.readFile('./test-res/01.zip')
	const zip = new JSZip()

	let files: string[] = []
	await zip.loadAsync(buf)
	zip.forEach(x => {
		files.push(x)
		console.log(x)
	})
	let idx = 0
	await drawFile(zip, files[idx])

	document.getElementById('prev')?.addEventListener('click', async () => {
		idx--
		await drawFile(zip, files[idx])
	})

	document.getElementById('next')?.addEventListener('click', async () => {
		idx++
		await drawFile(zip, files[idx])
	})

	const canvas = document.getElementById('view') as HTMLCanvasElement
	const loupe = document.getElementById('loupe') as HTMLCanvasElement
	const mainView = document.getElementById('main-view') as HTMLDivElement

	mainView.addEventListener('mousedown', e => {
		loupe.style.visibility = 'visible'
		e.preventDefault()
	})

	mainView.addEventListener('mouseup', e => {
		loupe.style.visibility = 'hidden'
		e.preventDefault()
	})

	mainView.addEventListener('mousemove', e => {
		const viewRect = mainView.getBoundingClientRect()
		const loupeRect = loupe.getBoundingClientRect()
		const rx = e.clientX - viewRect.x
		const ry = e.clientY - viewRect.y

		{
			const x = minmax(rx - loupeRect.width / 2, 0, viewRect.width - loupeRect.width)
			const y = minmax(ry - loupeRect.height / 2, 0, viewRect.height - loupeRect.height)

			loupe.style.left = `${x}px`
			loupe.style.top = `${y}px`
		}

		{
			const canvasRect = canvas.getBoundingClientRect()
			const rendered = renderedRect(canvas.width, canvas.height, canvasRect.width, canvasRect.height)

			const { width: w, height: h } = loupeRect
			loupe.width = w
			loupe.height = h
			const r = 1 / rendered.ratio
			const x = minmax((rx - rendered.x) * r - w / 4, 0, canvas.width - w / 2)
			const y = minmax((ry - rendered.y) * r - h / 4, 0, canvas.height - h / 2)

			const ctx = loupe.getContext('2d')
			ctx?.drawImage(canvas, x, y, w / 2, h / 2, 0, 0, w, h)
		}
	})
}

document.addEventListener('DOMContentLoaded', () => {
	main()
})
