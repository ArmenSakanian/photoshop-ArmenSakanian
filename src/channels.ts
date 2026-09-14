export type ChannelType = 'gray' | 'red' | 'green' | 'blue' | 'alpha' | 'mask'

const channelNames: Record<ChannelType, string> = {
  gray: 'Серый',
  red: 'Красный',
  green: 'Зеленый',
  blue: 'Синий',
  alpha: 'Альфа',
  mask: 'Маска',
}

function getChannelValue(data: Uint8ClampedArray, index: number, channel: ChannelType) {
  if (channel === 'red') {
    return data[index]
  }

  if (channel === 'green') {
    return data[index + 1]
  }

  if (channel === 'blue') {
    return data[index + 2]
  }

  if (channel === 'alpha' || channel === 'mask') {
    return data[index + 3]
  }

  return data[index]
}

function createPreview(imageData: ImageData, channel: ChannelType) {
  const maxWidth = 160
  const maxHeight = 110
  const scale = Math.min(maxWidth / imageData.width, maxHeight / imageData.height, 1)
  const width = Math.max(1, Math.round(imageData.width * scale))
  const height = Math.max(1, Math.round(imageData.height * scale))
  const preview = document.createElement('canvas')
  const previewContext = preview.getContext('2d')!
  const pixels = new Uint8ClampedArray(width * height * 4)

  preview.width = width
  preview.height = height

  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(imageData.height - 1, Math.floor(y * imageData.height / height))

    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(imageData.width - 1, Math.floor(x * imageData.width / width))
      const sourceIndex = (sourceY * imageData.width + sourceX) * 4
      const targetIndex = (y * width + x) * 4
      const value = getChannelValue(imageData.data, sourceIndex, channel)

      pixels[targetIndex] = value
      pixels[targetIndex + 1] = value
      pixels[targetIndex + 2] = value
      pixels[targetIndex + 3] = 255
    }
  }

  previewContext.putImageData(new ImageData(pixels, width, height), 0, 0)
  return preview
}

export function renderChannels(container: HTMLElement, imageData: ImageData, channels: ChannelType[]) {
  container.replaceChildren()

  for (const channel of channels) {
    const item = document.createElement('div')
    const preview = createPreview(imageData, channel)
    const name = document.createElement('span')

    item.className = 'channel-item'
    preview.className = 'channel-preview'
    name.className = 'channel-name'
    name.textContent = channelNames[channel]

    item.append(preview, name)
    container.append(item)
  }
}
