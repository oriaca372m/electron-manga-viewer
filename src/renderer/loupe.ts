function minmax(v: number, min: number, max: number): number {
	if (v < min) {
		return min
	}

	if (v > max) {
		return max
	}

	return v
}

function renderedRect(
	imgW: number,
	imgH: number,
	viewW: number,
	viewH: number
): { x: number; y: number; width: number; height: number; ratio: number } {
	const wRatio = viewW / imgW
	const hRatio = viewH / imgH
	const ratio = Math.min(wRatio, hRatio)
	const width = ratio * imgW
	const height = ratio * imgH
	return { ratio, width, height, x: (viewW - width) / 2, y: (viewH - height) / 2 }
}

export class Loupe {
	private ctx: CanvasRenderingContext2D

	// とりあえず
	private mainView = document.getElementById('main-view') as HTMLDivElement
	private canvas = document.getElementById('view') as HTMLCanvasElement

	constructor(private loupeElm: HTMLCanvasElement) {
		const ctx = this.loupeElm.getContext('2d')
		if (!ctx) {
			throw new Error('canvasのコンテキストが取得できませんでした')
		}
		this.ctx = ctx

		this.off()
		this.canvas.addEventListener('mousemove', (e) => {
			const viewRect = this.mainView.getBoundingClientRect()
			const rx = e.clientX - viewRect.x
			const ry = e.clientY - viewRect.y
			this.drawLoupe(rx, ry)
		})
	}

	on(): void {
		this.loupeElm.style.visibility = 'visible'
	}

	off(): void {
		this.loupeElm.style.visibility = 'hidden'
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
			const x = minmax(
				(rx - rendered.x) * r - w / zoomMultiplier / 2,
				0,
				canvas.width - w / 2
			)
			const y = minmax(
				(ry - rendered.y) * r - h / zoomMultiplier / 2,
				0,
				canvas.height - h / 2
			)

			this.ctx.drawImage(canvas, x, y, w / zoomMultiplier, h / zoomMultiplier, 0, 0, w, h)
		}
	}
}
