export type Gb7Image = {
  width: number
  height: number
  hasMask: boolean
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

  if ((flags & 0xfe) !== 0 || bytes[10] !== 0 || bytes[11] !== 0) {
    throw new Error('Некорректный заголовок GB7')
  }

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

    if (!hasMask && (value & 0x80) !== 0) {
      throw new Error('Некорректные данные GB7')
    }

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
    hasMask,
    data: new ImageData(pixels, width, height),
  }
}

export function encodeGb7(imageData: ImageData): ArrayBuffer {
  const { width, height, data } = imageData

  if (width < 1 || height < 1 || width > 65535 || height > 65535) {
    throw new Error('Размер изображения не поддерживается форматом GB7')
  }

  let hasMask = false

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 128) {
      hasMask = true
      break
    }
  }

  const result = new Uint8Array(12 + width * height)

  result[0] = 0x47
  result[1] = 0x42
  result[2] = 0x37
  result[3] = 0x1d
  result[4] = 0x01
  result[5] = hasMask ? 0x01 : 0x00
  result[6] = width >> 8
  result[7] = width & 0xff
  result[8] = height >> 8
  result[9] = height & 0xff

  for (let i = 0; i < width * height; i++) {
    const source = i * 4
    const red = data[source]
    const green = data[source + 1]
    const blue = data[source + 2]
    const alpha = data[source + 3]
    const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue)
    const gray7 = Math.round(gray * 127 / 255)
    const mask = hasMask && alpha >= 128 ? 0x80 : 0x00

    result[12 + i] = gray7 | mask
  }

  return result.buffer as ArrayBuffer
}
