import { Point, renderedRect, twoPointToRect } from './coordinate'
import { promises as fs } from 'fs'

export class Capture {
	#p1: Point = { x: 0, y: 0 }
	#p2: Point = { x: 0, y: 0 }
	#isEnabled = false

	// とりあえず
	private canvas = document.getElementById('view') as HTMLCanvasElement

	constructor(readonly elm: HTMLDivElement) {}

	setup(): void {
		document.addEventListener('keydown', (e) => {
			if (!this.#isEnabled) {
				return
			}

			if (e.code === 'Enter') {
				void this.capture()
			}
		})
	}

	#syncElm(): void {
		const rect = twoPointToRect(this.#p1, this.#p2)
		this.elm.style.left = `${rect.x}px`
		this.elm.style.top = `${rect.y}px`
		this.elm.style.width = `${rect.width}px`
		this.elm.style.height = `${rect.height}px`
		this.elm.style.display = this.#isEnabled ? 'block' : 'none'
	}

	enable(): void {
		this.#isEnabled = true
		this.#syncElm()
	}

	disable(): void {
		this.#isEnabled = false
		this.#syncElm()
	}

	toggle(): void {
		this.#isEnabled = !this.#isEnabled
		this.#syncElm()
	}

	get isEnabled(): boolean {
		return this.#isEnabled
	}

	onSelectStart(x: number, y: number): void {
		this.#p1 = { x, y }
		this.#p2 = { x, y }
		this.#syncElm()
	}

	onSelect(x: number, y: number): void {
		this.#p2 = { x, y }
		this.#syncElm()
	}

	onSelectEnd(x: number, y: number): void {
		this.onSelect(x, y)
	}

	async capture(): Promise<void> {
		const canvas = this.canvas
		const canvasRect = canvas.getBoundingClientRect()
		const rendered = renderedRect(
			canvas.width,
			canvas.height,
			canvasRect.width,
			canvasRect.height
		)

		const r = 1 / rendered.ratio
		const rect = twoPointToRect(this.#p1, this.#p2)

		const x = (rect.x - rendered.x) * r
		const y = (rect.y - rendered.y) * r
		const w = rect.width * r
		const h = rect.height * r

		const img = new OffscreenCanvas(w, h)
		const ctx = img.getContext('2d')
		if (ctx === null) {
			throw new Error('error')
		}
		ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h)

		this.disable()

		const blob = await img.convertToBlob({ type: 'image/png' })
		await fs.writeFile('test.png', new Uint8Array(await blob.arrayBuffer()))
	}
}
