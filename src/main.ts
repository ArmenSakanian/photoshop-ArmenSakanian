import './style.css'
import { decodeGb7, encodeGb7 } from './gb7'

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

    <main class="workspace">
      <div id="emptyState" class="empty-state">Изображение не открыто</div>
      <canvas id="canvas" hidden></canvas>
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
const context = canvas.getContext('2d')!

let currentFileName = 'image'

function showCanvas(width: number, height: number, depth: string) {
  emptyState.hidden = true
  canvas.hidden = false
  saveButton.disabled = false
  imageWidth.textContent = `Ширина: ${width} px`
  imageHeight.textContent = `Высота: ${height} px`
  colorDepth.textContent = `Глубина цвета: ${depth}`
}

function getBaseName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
}

async function getPngDepth(file: File) {
  const header = new Uint8Array(await file.slice(0, 26).arrayBuffer())

  if (header.length < 26) {
    return 'неизвестно'
  }

  const bitDepth = header[24]
  const colorType = header[25]
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

async function getBrowserImageDepth(file: File) {
  if (file.name.toLowerCase().endsWith('.png')) {
    return getPngDepth(file)
  }

  return '24 бит'
}

function openBrowserImage(file: File) {
  const image = new Image()
  const url = URL.createObjectURL(file)

  image.onload = async () => {
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)

    const depth = await getBrowserImageDepth(file)
    showCanvas(canvas.width, canvas.height, depth)
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
    showCanvas(image.width, image.height, image.hasMask ? '7 бит + маска' : '7 бит')
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
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  let exportCanvas = canvas

  if (mimeType === 'image/jpeg') {
    exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height

    const exportContext = exportCanvas.getContext('2d')!
    exportContext.fillStyle = '#ffffff'
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    exportContext.drawImage(canvas, 0, 0)
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
  try {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const bytes = encodeGb7(imageData)
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
