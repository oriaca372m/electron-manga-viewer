import { renderedRect } from './coordinate'
import { Capture } from './capture'

function minmax(v: number, min: number, max: number): number {
	if (v < min) {
		return min
	}

	if (v > max) {
		return max
	}

	return v
}

export class Loupe {
	private ctx: CanvasRenderingContext2D

	// とりあえず
	private mainView = document.getElementById('main-view') as HTMLDivElement
	private canvas = document.getElementById('view') as HTMLCanvasElement
	private eventListener: (e: MouseEvent) => void

	constructor(private loupeElm: HTMLCanvasElement, private readonly capture: Capture) {
		const ctx = this.loupeElm.getContext('2d')
		if (!ctx) {
			throw new Error('canvasのコンテキストが取得できませんでした')
		}
		this.ctx = ctx

		this.eventListener = (e) => {
			const viewRect = this.mainView.getBoundingClientRect()
			const rx = e.clientX - viewRect.x
			const ry = e.clientY - viewRect.y
			this.drawLoupe(rx, ry)
		}

		this.off()
	}

	on(): void {
		this.loupeElm.style.display = ''
		if (this.capture.isEnabled) {
			document.body.style.cursor = 'none'
		}

		this.mainView.addEventListener('mousemove', this.eventListener)
	}

	off(): void {
		this.loupeElm.style.display = 'none'
		document.body.style.cursor = 'auto'

		this.mainView.removeEventListener('mousemove', this.eventListener)
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
	}

	drawLoupe(rx: number, ry: number): void {
		const viewRect = this.mainView.getBoundingClientRect()
		const loupeRect = this.loupeElm.getBoundingClientRect()
		let zoomMultiplier = 1.5

		{
			const x = minmax(rx - loupeRect.width / 2, 0, viewRect.width - loupeRect.width)
			const y = minmax(ry - loupeRect.height / 2, 0, viewRect.height - loupeRect.height)

			this.loupeElm.style.left = `${x}px`
			this.loupeElm.style.top = `${y}px`
		}

		{
			const canvas = this.canvas
			const canvasRect = canvas.getBoundingClientRect()
			const rendered = renderedRect(
				canvas.width,
				canvas.height,
				canvasRect.width,
				canvasRect.height
			)
			const renderedZoomMultiplier = rendered.width / canvas.width
			zoomMultiplier = Math.max(zoomMultiplier, renderedZoomMultiplier * 1.5)

			const { width: w, height: h } = loupeRect
			this.loupeElm.width = w
			this.loupeElm.height = h
			const r = 1 / rendered.ratio

			const x = (rx - rendered.x) * r - w / zoomMultiplier / 2
			const y = (ry - rendered.y) * r - h / zoomMultiplier / 2

			this.ctx.drawImage(canvas, x, y, w / zoomMultiplier, h / zoomMultiplier, 0, 0, w, h)

			if (this.capture.isEnabled) {
				this.ctx.beginPath()
				this.ctx.moveTo(w / 2, 0)
				this.ctx.lineTo(w / 2, h)
				this.ctx.moveTo(0, h / 2)
				this.ctx.lineTo(w, h / 2)
				this.ctx.stroke()
			}
		}
	}
}
