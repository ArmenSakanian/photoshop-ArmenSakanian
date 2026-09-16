import type { ChannelType } from './channels'

export type LevelsChannel = 'master' | ChannelType
export type HistogramScale = 'linear' | 'log'

export type InputLevels = {
  black: number
  gamma: number
  white: number
}

const channelNames: Record<LevelsChannel, string> = {
  master: 'Master',
  gray: 'Серый',
  red: 'Красный',
  green: 'Зеленый',
  blue: 'Синий',
  alpha: 'Альфа',
  mask: 'Маска',
}

function srgbToLinear(value: number) {
  const normalized = value / 255

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance(data: Uint8ClampedArray, index: number, maxLevel: number) {
  const red = srgbToLinear(data[index])
  const green = srgbToLinear(data[index + 1])
  const blue = srgbToLinear(data[index + 2])
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

  return Math.round(luminance * maxLevel)
}

function getChannelValue(data: Uint8ClampedArray, index: number, channel: LevelsChannel, maxLevel: number) {
  if (channel === 'master') {
    return getRelativeLuminance(data, index, maxLevel)
  }

  if (channel === 'red' || channel === 'gray') {
    return Math.round(data[index] * maxLevel / 255)
  }

  if (channel === 'green') {
    return Math.round(data[index + 1] * maxLevel / 255)
  }

  if (channel === 'blue') {
    return Math.round(data[index + 2] * maxLevel / 255)
  }

  return Math.round(data[index + 3] * maxLevel / 255)
}

function createLut(settings: InputLevels, maxLevel: number) {
  const lut = new Uint8ClampedArray(maxLevel + 1)
  const range = settings.white - settings.black

  for (let value = 0; value <= maxLevel; value++) {
    if (value <= settings.black) {
      lut[value] = 0
      continue
    }

    if (value >= settings.white) {
      lut[value] = maxLevel
      continue
    }

    const normalized = (value - settings.black) / range
    lut[value] = Math.round(normalized ** (1 / settings.gamma) * maxLevel)
  }

  return lut
}

function applyLut(value: number, lut: Uint8ClampedArray, maxLevel: number) {
  const level = Math.round(value * maxLevel / 255)
  return Math.round(lut[level] * 255 / maxLevel)
}

export function createDefaultInputLevels(maxLevel: number): InputLevels {
  return {
    black: 0,
    gamma: 1,
    white: maxLevel,
  }
}

export function createLevelsSettings(channels: ChannelType[], maxLevel: number) {
  const settings = new Map<LevelsChannel, InputLevels>()

  settings.set('master', createDefaultInputLevels(maxLevel))

  for (const channel of channels) {
    settings.set(channel, createDefaultInputLevels(maxLevel))
  }

  return settings
}

export function gammaToMarkerPosition(settings: InputLevels) {
  const range = settings.white - settings.black
  const normalized = 0.5 ** settings.gamma

  return settings.black + normalized * range
}

export function markerPositionToGamma(position: number, black: number, white: number) {
  const range = white - black

  if (range <= 0) {
    return 1
  }

  const normalized = Math.min(0.999999, Math.max(0.000001, (position - black) / range))
  const gamma = Math.log(normalized) / Math.log(0.5)

  return Math.min(9.9, Math.max(0.1, gamma))
}

export function renderLevelsChannels(select: HTMLSelectElement, channels: ChannelType[]) {
  const values: LevelsChannel[] = ['master', ...channels]

  select.replaceChildren()

  for (const value of values) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = channelNames[value]
    select.append(option)
  }
}

export function createHistogram(
  imageData: ImageData,
  channel: LevelsChannel,
  maxLevel: number,
) {
  const histogram = new Uint32Array(maxLevel + 1)
  const data = imageData.data

  for (let index = 0; index < data.length; index += 4) {
    histogram[getChannelValue(data, index, channel, maxLevel)]++
  }

  return histogram
}

export function drawHistogram(
  canvas: HTMLCanvasElement,
  histogram: Uint32Array,
  scale: HistogramScale,
) {
  const context = canvas.getContext('2d')!
  const width = canvas.width
  const height = canvas.height
  let maxValue = 0

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#1c1c1c'
  context.fillRect(0, 0, width, height)

  for (const count of histogram) {
    const value = scale === 'log' ? Math.log1p(count) : count
    maxValue = Math.max(maxValue, value)
  }

  if (maxValue === 0) {
    return
  }

  context.fillStyle = '#c8c8c8'

  for (let level = 0; level < histogram.length; level++) {
    const count = histogram[level]

    if (count === 0) {
      continue
    }

    const value = scale === 'log' ? Math.log1p(count) : count
    const barHeight = Math.max(1, Math.round(value / maxValue * (height - 2)))
    const startX = Math.floor(level * width / histogram.length)
    const endX = Math.max(startX + 1, Math.floor((level + 1) * width / histogram.length))

    context.fillRect(startX, height - barHeight, endX - startX, barHeight)
  }
}

export function createLevelsPreview(
  imageData: ImageData,
  channels: ChannelType[],
  settings: Map<LevelsChannel, InputLevels>,
  maxLevel: number,
) {
  const source = imageData.data
  const pixels = new Uint8ClampedArray(source)
  const master = settings.get('master') ?? createDefaultInputLevels(maxLevel)
  const masterLut = createLut(master, maxLevel)
  const channelLuts = new Map<ChannelType, Uint8ClampedArray>()

  for (const channel of channels) {
    const channelSettings = settings.get(channel)

    if (channelSettings) {
      channelLuts.set(channel, createLut(channelSettings, maxLevel))
    }
  }

  for (let index = 0; index < source.length; index += 4) {
    pixels[index] = applyLut(source[index], masterLut, maxLevel)
    pixels[index + 1] = applyLut(source[index + 1], masterLut, maxLevel)
    pixels[index + 2] = applyLut(source[index + 2], masterLut, maxLevel)

    if (channels.includes('gray')) {
      const grayLut = channelLuts.get('gray')

      if (grayLut) {
        const gray = applyLut(pixels[index], grayLut, maxLevel)
        pixels[index] = gray
        pixels[index + 1] = gray
        pixels[index + 2] = gray
      }
    } else {
      const redLut = channelLuts.get('red')
      const greenLut = channelLuts.get('green')
      const blueLut = channelLuts.get('blue')

      if (redLut) {
        pixels[index] = applyLut(pixels[index], redLut, maxLevel)
      }

      if (greenLut) {
        pixels[index + 1] = applyLut(pixels[index + 1], greenLut, maxLevel)
      }

      if (blueLut) {
        pixels[index + 2] = applyLut(pixels[index + 2], blueLut, maxLevel)
      }
    }

    const alphaChannel = channels.includes('alpha') ? 'alpha' : channels.includes('mask') ? 'mask' : null

    if (alphaChannel) {
      const alphaLut = channelLuts.get(alphaChannel)

      if (alphaLut) {
        pixels[index + 3] = applyLut(pixels[index + 3], alphaLut, maxLevel)
      }
    }
  }

  return new ImageData(pixels, imageData.width, imageData.height)
}
