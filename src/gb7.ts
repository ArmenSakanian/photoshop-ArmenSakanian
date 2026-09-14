export type Gb7Image = {
  width: number
  height: number
  data: ImageData
}

export function decodeGb7(buffer: ArrayBuffer): Gb7Image {
  const bytes = new Uint8Array(buffer)

  if (bytes.length < 12) {
    throw new Error('Некорректный файл GB7')
  }

  if (bytes[0] !== 0x47 || bytes[1] !== 0x42 || bytes[2] !== 0x37 || bytes[3] !== 0x1d) {
    throw new Error('Некорректная сигнатура GB7')
  }

  if (bytes[4] !== 0x01) {
    throw new Error('Неподдерживаемая версия GB7')
  }

  const flags = bytes[5]
  const hasMask = (flags & 0x01) !== 0
  const width = (bytes[6] << 8) | bytes[7]
  const height = (bytes[8] << 8) | bytes[9]
  const pixelCount = width * height

  if (width === 0 || height === 0 || bytes.length !== 12 + pixelCount) {
    throw new Error('Некорректные размеры GB7')
  }

  const pixels = new Uint8ClampedArray(pixelCount * 4)

  for (let i = 0; i < pixelCount; i++) {
    const value = bytes[12 + i]
    const gray = Math.round((value & 0x7f) * 255 / 127)
    const alpha = hasMask && (value & 0x80) === 0 ? 0 : 255
    const index = i * 4

    pixels[index] = gray
    pixels[index + 1] = gray
    pixels[index + 2] = gray
    pixels[index + 3] = alpha
  }

  return {
    width,
    height,
    data: new ImageData(pixels, width, height),
  }
}
