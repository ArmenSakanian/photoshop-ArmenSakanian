function getPngDepth(bytes: Uint8Array) {
  if (bytes.length < 26) {
    return 'неизвестно'
  }

  const bitDepth = bytes[24]
  const colorType = bytes[25]
  const channels: Record<number, number> = {
    0: 1,
    2: 3,
    4: 2,
    6: 4,
  }

  if (colorType === 3) {
    return `${bitDepth} бит (палитра)`
  }

  const channelCount = channels[colorType]
  return channelCount ? `${bitDepth * channelCount} бит` : 'неизвестно'
}

function isSofMarker(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
}

function getJpegDepth(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return 'неизвестно'
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
      return `${precision * components} бит`
    }

    offset += length
  }

  return 'неизвестно'
}

export async function getImageDepth(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  if (name.endsWith('.png')) {
    return getPngDepth(bytes)
  }

  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return getJpegDepth(bytes)
  }

  return 'неизвестно'
}
