import type { ChannelType } from './channels'

export type LevelsChannel = 'master' | ChannelType
export type HistogramScale = 'linear' | 'log'

const channelNames: Record<LevelsChannel, string> = {
  master: 'Master',
  gray: 'Серый',
  red: 'Красный',
  green: 'Зеленый',
  blue: 'Синий',
  alpha: 'Альфа',
  mask: 'Маска',
}

function getValue(data: Uint8ClampedArray, index: number, channel: LevelsChannel) {
  if (channel === 'master') {
    return Math.round(
      0.299 * data[index] +
      0.587 * data[index + 1] +
      0.114 * data[index + 2],
    )
  }

  if (channel === 'red' || channel === 'gray') {
    return data[index]
  }

  if (channel === 'green') {
    return data[index + 1]
  }

  if (channel === 'blue') {
    return data[index + 2]
  }

  return data[index + 3]
}

function toLevel(value: number, maxLevel: number) {
  return maxLevel === 127
    ? Math.round(value * 127 / 255)
    : value
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
    const value = getValue(data, index, channel)
    histogram[toLevel(value, maxLevel)]++
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
