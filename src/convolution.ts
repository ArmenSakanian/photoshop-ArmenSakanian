import type { ChannelType } from './channels'
import type { EdgeHandling } from './kernels'

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

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

function convolveChannel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  offset: number,
  kernel: readonly number[],
  edgeHandling: EdgeHandling,
) {
  let value = 0
  let kernelIndex = 0

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      value += sampleChannel(
        source,
        width,
        height,
        x + offsetX,
        y + offsetY,
        offset,
        edgeHandling,
      ) * kernel[kernelIndex]
      kernelIndex++
    }
  }

  return clampByte(value)
}

export function applyKernel(
  imageData: ImageData,
  kernel: readonly number[],
  channels: readonly ChannelType[],
  selectedChannels: ReadonlySet<ChannelType>,
  edgeHandling: EdgeHandling,
) {
  if (kernel.length !== 9) {
    throw new Error('Ядро должно содержать 9 коэффициентов')
  }

  const { width, height } = imageData
  const source = imageData.data
  const result = new Uint8ClampedArray(source)
  const hasGray = channels.includes('gray')
  const hasMask = channels.includes('mask')

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4

      if (hasGray) {
        if (selectedChannels.has('gray')) {
          const gray = convolveChannel(source, width, height, x, y, 0, kernel, edgeHandling)
          result[index] = gray
          result[index + 1] = gray
          result[index + 2] = gray
        }
      } else {
        if (selectedChannels.has('red')) {
          result[index] = convolveChannel(source, width, height, x, y, 0, kernel, edgeHandling)
        }

        if (selectedChannels.has('green')) {
          result[index + 1] = convolveChannel(source, width, height, x, y, 1, kernel, edgeHandling)
        }

        if (selectedChannels.has('blue')) {
          result[index + 2] = convolveChannel(source, width, height, x, y, 2, kernel, edgeHandling)
        }
      }

      if (selectedChannels.has('alpha')) {
        result[index + 3] = convolveChannel(source, width, height, x, y, 3, kernel, edgeHandling)
      }

      if (selectedChannels.has('mask')) {
        const mask = convolveChannel(source, width, height, x, y, 3, kernel, edgeHandling)
        result[index + 3] = mask >= 128 ? 255 : 0
      } else if (hasMask) {
        result[index + 3] = source[index + 3] >= 128 ? 255 : 0
      }
    }
  }

  return new ImageData(result, width, height)
}
