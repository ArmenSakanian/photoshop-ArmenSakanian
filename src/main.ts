import './style.css'
import { decodeGb7, encodeGb7 } from './gb7'
import { getImageInfo } from './image-info'
import { createChannelView, renderChannels, type ChannelType } from './channels'
import { getPixelPosition, getPixelRgb } from './pipette'
import { rgbToLab } from './color'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="editor">
    <header class="toolbar">
      <div class="toolbar-title">Photoshop</div>
      <div class="toolbar-actions">
        <button id="openButton" type="button">Открыть</button>
        <button
          id="pipetteButton"
          class="tool-button"
          type="button"
          disabled
          aria-label="Пипетка"
          aria-pressed="false"
          title="Пипетка"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4 20 9 18 11 13 6 15 4Z"></path>
            <path d="M13.5 7.5 6.5 14.5 5 19 9.5 17.5 16.5 10.5"></path>
            <path d="M6.5 14.5 9.5 17.5"></path>
          </svg>
        </button>
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
        <div class="pipette-info">
          <div class="pipette-info-title">Пипетка</div>
          <div class="pipette-values">
            <span id="pipetteX">X: -</span>
            <span id="pipetteY">Y: -</span>
            <span id="pipetteR">R: -</span>
            <span id="pipetteG">G: -</span>
            <span id="pipetteB">B: -</span>
            <span id="pipetteL">L*: -</span>
            <span id="pipetteA">a*: -</span>
            <span id="pipetteLabB">b*: -</span>
            <span id="pipetteColor" class="pipette-color" aria-label="Выбранный цвет"></span>
          </div>
        </div>
      </aside>
    </main>

    <div id="pipettePreview" class="pipette-preview" hidden>
      <span id="pipettePreviewColor" class="pipette-preview-color"></span>
    </div>

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
const pipetteButton = document.querySelector<HTMLButtonElement>('#pipetteButton')!
const saveFormat = document.querySelector<HTMLSelectElement>('#saveFormat')!
const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const emptyState = document.querySelector<HTMLDivElement>('#emptyState')!
const imageWidth = document.querySelector<HTMLSpanElement>('#imageWidth')!
const imageHeight = document.querySelector<HTMLSpanElement>('#imageHeight')!
const colorDepth = document.querySelector<HTMLSpanElement>('#colorDepth')!
const channelsPanel = document.querySelector<HTMLElement>('#channelsPanel')!
const channelsList = document.querySelector<HTMLDivElement>('#channelsList')!
const pipetteX = document.querySelector<HTMLSpanElement>('#pipetteX')!
const pipetteY = document.querySelector<HTMLSpanElement>('#pipetteY')!
const pipetteR = document.querySelector<HTMLSpanElement>('#pipetteR')!
const pipetteG = document.querySelector<HTMLSpanElement>('#pipetteG')!
const pipetteB = document.querySelector<HTMLSpanElement>('#pipetteB')!
const pipetteL = document.querySelector<HTMLSpanElement>('#pipetteL')!
const pipetteA = document.querySelector<HTMLSpanElement>('#pipetteA')!
const pipetteLabB = document.querySelector<HTMLSpanElement>('#pipetteLabB')!
const pipetteColor = document.querySelector<HTMLSpanElement>('#pipetteColor')!
const pipettePreview = document.querySelector<HTMLDivElement>('#pipettePreview')!
const pipettePreviewColor = document.querySelector<HTMLSpanElement>('#pipettePreviewColor')!
const context = canvas.getContext('2d')!

let currentFileName = 'image'
let currentImageData: ImageData | null = null
let currentChannels: ChannelType[] = []
let activeChannels = new Set<ChannelType>()
let pipetteActive = false
let pipetteDragging = false

function formatLabValue(value: number) {
  return Math.abs(value) < 0.005 ? '0.00' : value.toFixed(2)
}

function resetPipetteInfo() {
  pipetteX.textContent = 'X: -'
  pipetteY.textContent = 'Y: -'
  pipetteR.textContent = 'R: -'
  pipetteG.textContent = 'G: -'
  pipetteB.textContent = 'B: -'
  pipetteL.textContent = 'L*: -'
  pipetteA.textContent = 'a*: -'
  pipetteLabB.textContent = 'b*: -'
  pipetteColor.style.background = 'transparent'
}

function hidePipettePreview() {
  pipettePreview.hidden = true
}

function setPipetteActive(active: boolean) {
  pipetteActive = active
  pipetteDragging = false
  pipetteButton.classList.toggle('active', active)
  pipetteButton.setAttribute('aria-pressed', String(active))
  canvas.classList.toggle('pipette-active', active)
  hidePipettePreview()
}

function sampleColor(event: MouseEvent, showPreview: boolean) {
  if (!currentImageData) {
    return
  }

  const position = getPixelPosition(event, canvas)

  if (!position) {
    hidePipettePreview()
    return
  }

  const color = getPixelRgb(currentImageData, position)
  const lab = rgbToLab(color.r, color.g, color.b)
  const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`

  pipetteX.textContent = `X: ${position.x}`
  pipetteY.textContent = `Y: ${position.y}`
  pipetteR.textContent = `R: ${color.r}`
  pipetteG.textContent = `G: ${color.g}`
  pipetteB.textContent = `B: ${color.b}`
  pipetteL.textContent = `L*: ${formatLabValue(lab.l)}`
  pipetteA.textContent = `a*: ${formatLabValue(lab.a)}`
  pipetteLabB.textContent = `b*: ${formatLabValue(lab.b)}`
  pipetteColor.style.background = rgb

  if (showPreview) {
    const previewX = Math.min(Math.max(event.clientX + 16, 8), window.innerWidth - 46)
    const previewY = Math.min(Math.max(event.clientY + 16, 8), window.innerHeight - 46)

    pipettePreviewColor.style.background = rgb
    pipettePreview.style.left = `${previewX}px`
    pipettePreview.style.top = `${previewY}px`
    pipettePreview.hidden = false
  }
}

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
  pipetteButton.disabled = false
  resetPipetteInfo()
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

pipetteButton.addEventListener('click', () => {
  if (!currentImageData) {
    return
  }

  setPipetteActive(!pipetteActive)
})

canvas.addEventListener('pointerdown', (event) => {
  if (!pipetteActive || !currentImageData || event.button !== 0) {
    return
  }

  pipetteDragging = true
  canvas.setPointerCapture(event.pointerId)
  sampleColor(event, true)
})

canvas.addEventListener('pointermove', (event) => {
  if (!pipetteActive || !pipetteDragging) {
    return
  }

  sampleColor(event, true)
})

canvas.addEventListener('pointerup', (event) => {
  if (!pipetteDragging || event.button !== 0) {
    return
  }

  sampleColor(event, false)
  pipetteDragging = false
  hidePipettePreview()

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }
})

canvas.addEventListener('pointercancel', (event) => {
  pipetteDragging = false
  hidePipettePreview()

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }
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
