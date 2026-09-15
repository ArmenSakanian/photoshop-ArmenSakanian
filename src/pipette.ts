export type PixelPosition = {
  x: number
  y: number
}

export type RgbColor = {
  r: number
  g: number
  b: number
}

export function getPixelPosition(event: MouseEvent, canvas: HTMLCanvasElement): PixelPosition | null {
  const rect = canvas.getBoundingClientRect()

  if (rect.width === 0 || rect.height === 0) {
    return null
  }

  const localX = event.clientX - rect.left
  const localY = event.clientY - rect.top

  if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
    return null
  }

  const x = Math.min(
    canvas.width - 1,
    Math.max(0, Math.floor(localX * canvas.width / rect.width)),
  )
  const y = Math.min(
    canvas.height - 1,
    Math.max(0, Math.floor(localY * canvas.height / rect.height)),
  )

  return { x, y }
}

export function getPixelRgb(imageData: ImageData, position: PixelPosition): RgbColor {
  const index = (position.y * imageData.width + position.x) * 4

  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
  }
}
