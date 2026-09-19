import type { ChannelType } from './channels'
import type { EdgeHandling } from './kernels'

function sampleChannel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  offset: number,
  edgeHandling: EdgeHandling,
) {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    return source[(y * width + x) * 4 + offset]
  }

  if (edgeHandling === 'black') {
    return 0
  }

  if (edgeHandling === 'white') {
    return 255
  }

  const copyX = Math.max(0, Math.min(width - 1, x))
  const copyY = Math.max(0, Math.min(height - 1, y))
  return source[(copyY * width + copyX) * 4 + offset]
}

function medianChannel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  offset: number,
  edgeHandling: EdgeHandling,
) {
  const values: number[] = []

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      values.push(sampleChannel(
        source,
        width,
        height,
        x + offsetX,
        y + offsetY,
        offset,
        edgeHandling,
      ))
    }
  }

  values.sort((a, b) => a - b)
  return values[4]
}

function processRows(
  source: Uint8ClampedArray,
  result: Uint8ClampedArray,
  width: number,
  height: number,
  startY: number,
  endY: number,
  channels: readonly ChannelType[],
  selectedChannels: ReadonlySet<ChannelType>,
  edgeHandling: EdgeHandling,
) {
  const hasGray = channels.includes('gray')
  const hasMask = channels.includes('mask')

  for (let y = startY; y < endY; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4

      if (hasGray) {
        if (selectedChannels.has('gray')) {
          const gray = medianChannel(source, width, height, x, y, 0, edgeHandling)
          result[index] = gray
          result[index + 1] = gray
          result[index + 2] = gray
        }
      } else {
        if (selectedChannels.has('red')) {
          result[index] = medianChannel(source, width, height, x, y, 0, edgeHandling)
        }

        if (selectedChannels.has('green')) {
          result[index + 1] = medianChannel(source, width, height, x, y, 1, edgeHandling)
        }

        if (selectedChannels.has('blue')) {
          result[index + 2] = medianChannel(source, width, height, x, y, 2, edgeHandling)
        }
      }

      if (selectedChannels.has('alpha')) {
        result[index + 3] = medianChannel(source, width, height, x, y, 3, edgeHandling)
      }

      if (selectedChannels.has('mask')) {
        const mask = medianChannel(source, width, height, x, y, 3, edgeHandling)
        result[index + 3] = mask >= 128 ? 255 : 0
      } else if (hasMask) {
        result[index + 3] = source[index + 3] >= 128 ? 255 : 0
      }
    }
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Операция отменена', 'AbortError')
  }
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

export async function applyMedianAsync(
  imageData: ImageData,
  channels: readonly ChannelType[],
  selectedChannels: ReadonlySet<ChannelType>,
  edgeHandling: EdgeHandling,
  signal?: AbortSignal,
) {
  throwIfAborted(signal)

  const { width, height } = imageData
  const source = imageData.data
  const result = new Uint8ClampedArray(source)
  const rowsPerBatch = Math.max(1, Math.floor(30_000 / Math.max(1, width)))

  for (let startY = 0; startY < height; startY += rowsPerBatch) {
    throwIfAborted(signal)

    processRows(
      source,
      result,
      width,
      height,
      startY,
      Math.min(height, startY + rowsPerBatch),
      channels,
      selectedChannels,
      edgeHandling,
    )

    if (startY + rowsPerBatch < height) {
      await yieldToBrowser()
    }
  }

  throwIfAborted(signal)
  return new ImageData(result, width, height)
}
