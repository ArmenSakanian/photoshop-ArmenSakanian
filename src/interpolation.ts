export type InterpolationMethod = 'nearest' | 'bilinear'

type Interpolator = (
  source: ImageData,
  width: number,
  height: number,
) => ImageData

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function nearestNeighbor(source: ImageData, width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const sourcePixels = source.data
  const scaleX = source.width / width
  const scaleY = source.height / height

  for (let y = 0; y < height; y++) {
    const sourceY = clamp(Math.round((y + 0.5) * scaleY - 0.5), 0, source.height - 1)

    for (let x = 0; x < width; x++) {
      const sourceX = clamp(Math.round((x + 0.5) * scaleX - 0.5), 0, source.width - 1)
      const sourceIndex = (sourceY * source.width + sourceX) * 4
      const targetIndex = (y * width + x) * 4

      pixels[targetIndex] = sourcePixels[sourceIndex]
      pixels[targetIndex + 1] = sourcePixels[sourceIndex + 1]
      pixels[targetIndex + 2] = sourcePixels[sourceIndex + 2]
      pixels[targetIndex + 3] = sourcePixels[sourceIndex + 3]
    }
  }

  return new ImageData(pixels, width, height)
}

function bilinear(source: ImageData, width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const sourcePixels = source.data
  const scaleX = source.width / width
  const scaleY = source.height / height

  for (let y = 0; y < height; y++) {
    const sourceY = (y + 0.5) * scaleY - 0.5
    const sourceY0 = Math.floor(sourceY)
    const y0 = clamp(sourceY0, 0, source.height - 1)
    const y1 = clamp(sourceY0 + 1, 0, source.height - 1)
    const dy = clamp(sourceY - sourceY0, 0, 1)

    for (let x = 0; x < width; x++) {
      const sourceX = (x + 0.5) * scaleX - 0.5
      const sourceX0 = Math.floor(sourceX)
      const x0 = clamp(sourceX0, 0, source.width - 1)
      const x1 = clamp(sourceX0 + 1, 0, source.width - 1)
      const dx = clamp(sourceX - sourceX0, 0, 1)
      const topLeft = (y0 * source.width + x0) * 4
      const topRight = (y0 * source.width + x1) * 4
      const bottomLeft = (y1 * source.width + x0) * 4
      const bottomRight = (y1 * source.width + x1) * 4
      const targetIndex = (y * width + x) * 4

      for (let channel = 0; channel < 4; channel++) {
        const top = sourcePixels[topLeft + channel] * (1 - dx)
          + sourcePixels[topRight + channel] * dx
        const bottom = sourcePixels[bottomLeft + channel] * (1 - dx)
          + sourcePixels[bottomRight + channel] * dx

        pixels[targetIndex + channel] = Math.round(top * (1 - dy) + bottom * dy)
      }
    }
  }

  return new ImageData(pixels, width, height)
}

export const interpolationMethods: Record<InterpolationMethod, Interpolator> = {
  nearest: nearestNeighbor,
  bilinear,
}

export function resizeImageData(
  source: ImageData,
  width: number,
  height: number,
  method: InterpolationMethod = 'bilinear',
) {
  const targetWidth = Math.max(1, Math.round(width))
  const targetHeight = Math.max(1, Math.round(height))

  if (targetWidth === source.width && targetHeight === source.height) {
    return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  }

  return interpolationMethods[method](source, targetWidth, targetHeight)
}
