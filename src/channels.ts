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

export function createChannelView(imageData: ImageData, channels: ChannelType[], activeChannels: Set<ChannelType>) {
  const source = imageData.data
  const pixels = new Uint8ClampedArray(source.length)
  const hasGray = channels.includes('gray')
  const alphaChannel = channels.includes('alpha') ? 'alpha' : channels.includes('mask') ? 'mask' : null
  const onlyAlpha = Boolean(alphaChannel && activeChannels.size === 1 && activeChannels.has(alphaChannel))

  for (let index = 0; index < source.length; index += 4) {
    if (onlyAlpha) {
      const alpha = source[index + 3]
      pixels[index] = alpha
      pixels[index + 1] = alpha
      pixels[index + 2] = alpha
      pixels[index + 3] = 255
      continue
    }

    if (hasGray) {
      const gray = activeChannels.has('gray') ? source[index] : 0
      pixels[index] = gray
      pixels[index + 1] = gray
      pixels[index + 2] = gray
    } else {
      pixels[index] = activeChannels.has('red') ? source[index] : 0
      pixels[index + 1] = activeChannels.has('green') ? source[index + 1] : 0
      pixels[index + 2] = activeChannels.has('blue') ? source[index + 2] : 0
    }

    pixels[index + 3] = alphaChannel && activeChannels.has(alphaChannel) ? source[index + 3] : 255
  }

  return new ImageData(pixels, imageData.width, imageData.height)
}

export function renderChannels(
  container: HTMLElement,
  imageData: ImageData,
  channels: ChannelType[],
  activeChannels: Set<ChannelType>,
  onToggle: (channel: ChannelType, active: boolean) => void,
) {
  container.replaceChildren()

  for (const channel of channels) {
    const item = document.createElement('button')
    const preview = createPreview(imageData, channel)
    const name = document.createElement('span')
    const active = activeChannels.has(channel)

    item.type = 'button'
    item.className = `channel-item${active ? ' active' : ''}`
    item.setAttribute('aria-pressed', String(active))
    preview.className = 'channel-preview'
    name.className = 'channel-name'
    name.textContent = channelNames[channel]

    item.addEventListener('click', () => {
      const nextActive = item.getAttribute('aria-pressed') !== 'true'
      item.setAttribute('aria-pressed', String(nextActive))
      item.classList.toggle('active', nextActive)
      onToggle(channel, nextActive)
    })

    item.append(preview, name)
    container.append(item)
  }
}
