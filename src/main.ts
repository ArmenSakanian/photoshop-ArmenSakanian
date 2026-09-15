import './style.css'
import { decodeGb7, encodeGb7 } from './gb7'
import { getImageInfo } from './image-info'
import { createChannelView, renderChannels, type ChannelType } from './channels'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="editor">
    <header class="toolbar">
      <div class="toolbar-title">Photoshop</div>
      <div class="toolbar-actions">
        <button id="openButton" type="button">Открыть</button>
        <select id="saveFormat" aria-label="Формат сохранения">
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="jpeg">JPEG</option>
          <option value="gb7">GB7</option>
        </select>
        <button id="saveButton" type="button" disabled>Сохранить</button>
      </div>
    </header>

    <main class="main-area">
      <section class="workspace">
        <div id="emptyState" class="empty-state">Изображение не открыто</div>
        <canvas id="canvas" hidden></canvas>
      </section>

      <aside id="channelsPanel" class="channels-panel" hidden>
        <div class="channels-title">Каналы</div>
        <div id="channelsList" class="channels-list"></div>
      </aside>
    </main>

    <footer class="statusbar">
      <span id="imageWidth">Ширина: 0 px</span>
      <span id="imageHeight">Высота: 0 px</span>
      <span id="colorDepth">Глубина цвета: -</span>
    </footer>

    <input
      id="fileInput"
      type="file"
      accept=".png,.jpg,.jpeg,.gb7,image/png,image/jpeg"
      hidden
    />
  </div>
`

const openButton = document.querySelector<HTMLButtonElement>('#openButton')!
const saveButton = document.querySelector<HTMLButtonElement>('#saveButton')!
const saveFormat = document.querySelector<HTMLSelectElement>('#saveFormat')!
const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const emptyState = document.querySelector<HTMLDivElement>('#emptyState')!
const imageWidth = document.querySelector<HTMLSpanElement>('#imageWidth')!
const imageHeight = document.querySelector<HTMLSpanElement>('#imageHeight')!
const colorDepth = document.querySelector<HTMLSpanElement>('#colorDepth')!
const channelsPanel = document.querySelector<HTMLElement>('#channelsPanel')!
const channelsList = document.querySelector<HTMLDivElement>('#channelsList')!
const context = canvas.getContext('2d')!

let currentFileName = 'image'
let currentImageData: ImageData | null = null
let currentChannels: ChannelType[] = []
let activeChannels = new Set<ChannelType>()

function renderCurrentImage() {
  if (!currentImageData) {
    return
  }

  const visibleImage = createChannelView(currentImageData, currentChannels, activeChannels)
  context.putImageData(visibleImage, 0, 0)
}

function showCanvas(width: number, height: number, depth: string, channels: ChannelType[]) {
  emptyState.hidden = true
  canvas.hidden = false
  channelsPanel.hidden = false
  saveButton.disabled = false
  imageWidth.textContent = `Ширина: ${width} px`
  imageHeight.textContent = `Высота: ${height} px`
  colorDepth.textContent = `Глубина цвета: ${depth}`
  currentChannels = channels
  activeChannels = new Set(channels)

  if (currentImageData) {
    renderCurrentImage()
    renderChannels(channelsList, currentImageData, channels, activeChannels, (channel, active) => {
      if (active) {
        activeChannels.add(channel)
      } else {
        activeChannels.delete(channel)
      }

      renderCurrentImage()
    })
  }
}

function getBaseName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
}

function openBrowserImage(file: File) {
  const image = new Image()
  const url = URL.createObjectURL(file)

  image.onload = async () => {
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)

    currentImageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const info = await getImageInfo(file)
    showCanvas(canvas.width, canvas.height, info.depth, info.channels)
    URL.revokeObjectURL(url)
  }

  image.onerror = () => {
    URL.revokeObjectURL(url)
    alert('Не удалось открыть изображение')
  }

  image.src = url
}

async function openGb7(file: File) {
  try {
    const buffer = await file.arrayBuffer()
    const image = decodeGb7(buffer)

    canvas.width = image.width
    canvas.height = image.height
    context.putImageData(image.data, 0, 0)
    currentImageData = image.data
    const channels: ChannelType[] = image.hasMask ? ['gray', 'mask'] : ['gray']
    showCanvas(image.width, image.height, image.hasMask ? '7 бит + маска' : '7 бит', channels)
  } catch {
    alert('Не удалось открыть файл GB7')
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function saveCanvasImage(format: 'png' | 'jpg' | 'jpeg') {
  if (!currentImageData) {
    return
  }

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  const sourceCanvas = document.createElement('canvas')
  const sourceContext = sourceCanvas.getContext('2d')!

  sourceCanvas.width = currentImageData.width
  sourceCanvas.height = currentImageData.height
  sourceContext.putImageData(currentImageData, 0, 0)

  let exportCanvas = sourceCanvas

  if (mimeType === 'image/jpeg') {
    exportCanvas = document.createElement('canvas')
    exportCanvas.width = sourceCanvas.width
    exportCanvas.height = sourceCanvas.height

    const exportContext = exportCanvas.getContext('2d')!
    exportContext.fillStyle = '#ffffff'
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportContext.drawImage(sourceCanvas, 0, 0)
  }

  exportCanvas.toBlob((blob) => {
    if (!blob) {
      alert('Не удалось сохранить изображение')
      return
    }

    downloadBlob(blob, `${currentFileName}.${format}`)
  }, mimeType, 0.92)
}

function saveGb7() {
  if (!currentImageData) {
    return
  }

  try {
    const bytes = encodeGb7(currentImageData)
    const blob = new Blob([bytes], { type: 'application/octet-stream' })

    downloadBlob(blob, `${currentFileName}.gb7`)
  } catch {
    alert('Не удалось сохранить файл GB7')
  }
}

openButton.addEventListener('click', () => {
  fileInput.click()
})

saveButton.addEventListener('click', () => {
  const format = saveFormat.value

  if (format === 'gb7') {
    saveGb7()
    return
  }

  saveCanvasImage(format as 'png' | 'jpg' | 'jpeg')
})

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]

  if (!file) {
    return
  }

  currentFileName = getBaseName(file.name)

  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension && ['png', 'jpg', 'jpeg', 'gb7'].includes(extension)) {
    saveFormat.value = extension
  }

  if (file.name.toLowerCase().endsWith('.gb7')) {
    await openGb7(file)
  } else {
    openBrowserImage(file)
  }

  fileInput.value = ''
})
