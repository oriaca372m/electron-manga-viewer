export interface Point {
	x: number
	y: number
}

export interface Rect {
	x: number
	y: number
	width: number
	height: number
}

export function renderedRect(
	imgW: number,
	imgH: number,
	viewW: number,
	viewH: number
): Rect & { ratio: number } {
	const wRatio = viewW / imgW
	const hRatio = viewH / imgH
	const ratio = Math.min(wRatio, hRatio)
	const width = ratio * imgW
	const height = ratio * imgH
	return { ratio, width, height, x: (viewW - width) / 2, y: (viewH - height) / 2 }
}

export function twoPointToRect(p1: Point, p2: Point): Rect {
	const x = Math.min(p1.x, p2.x)
	const y = Math.min(p1.y, p2.y)
	const width = Math.abs(p1.x - p2.x)
	const height = Math.abs(p1.y - p2.y)
	return { x, y, width, height }
}
