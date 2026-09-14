import type { ChannelType } from './channels'

export type ImageInfo = {
  depth: string
  channels: ChannelType[]
}

function hasPngTransparency(bytes: Uint8Array) {
  let offset = 8

  while (offset + 12 <= bytes.length) {
    const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]

    if (length < 0 || offset + 12 + length > bytes.length) {
      return false
    }

    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])

    if (type === 'tRNS') {
      return true
    }

    if (type === 'IEND') {
      return false
    }

    offset += 12 + length
  }

  return false
}

function getPngInfo(bytes: Uint8Array): ImageInfo {
  if (
    bytes.length < 26 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return { depth: 'неизвестно', channels: ['red', 'green', 'blue'] }
  }

  const bitDepth = bytes[24]
  const colorType = bytes[25]

  if (colorType === 0) {
    return { depth: `${bitDepth} бит`, channels: ['gray'] }
  }

  if (colorType === 2) {
    return { depth: `${bitDepth * 3} бит`, channels: ['red', 'green', 'blue'] }
  }

  if (colorType === 3) {
    const channels: ChannelType[] = hasPngTransparency(bytes)
      ? ['red', 'green', 'blue', 'alpha']
      : ['red', 'green', 'blue']

    return { depth: `${bitDepth} бит (палитра)`, channels }
  }

  if (colorType === 4) {
    return { depth: `${bitDepth * 2} бит`, channels: ['gray', 'alpha'] }
  }

  if (colorType === 6) {
    return { depth: `${bitDepth * 4} бит`, channels: ['red', 'green', 'blue', 'alpha'] }
  }

  return { depth: 'неизвестно', channels: ['red', 'green', 'blue'] }
}

function isSofMarker(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
}

function getJpegInfo(bytes: Uint8Array): ImageInfo {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { depth: 'неизвестно', channels: ['red', 'green', 'blue'] }
  }

  let offset = 2

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset++
    }

    if (offset >= bytes.length) {
      break
    }

    const marker = bytes[offset++]

    if (marker === 0xd9 || marker === 0xda) {
      break
    }

    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) {
      continue
    }

    if (offset + 1 >= bytes.length) {
      break
    }

    const length = (bytes[offset] << 8) | bytes[offset + 1]

    if (length < 2 || offset + length > bytes.length) {
      break
    }

    if (isSofMarker(marker) && length >= 8) {
      const precision = bytes[offset + 2]
      const components = bytes[offset + 7]
      const channels: ChannelType[] = components === 1
        ? ['gray']
        : ['red', 'green', 'blue']

      return {
        depth: `${precision * components} бит`,
        channels,
      }
    }

    offset += length
  }

  return { depth: 'неизвестно', channels: ['red', 'green', 'blue'] }
}

export async function getImageInfo(file: File): Promise<ImageInfo> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  if (name.endsWith('.png')) {
    return getPngInfo(bytes)
  }

  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return getJpegInfo(bytes)
  }

  return { depth: 'неизвестно', channels: ['red', 'green', 'blue'] }
}
