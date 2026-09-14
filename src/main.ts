import './style.css'
import { decodeGb7 } from './gb7'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="editor">
    <header class="toolbar">
      <div class="toolbar-title">Photoshop</div>
      <div class="toolbar-actions">
        <button id="openButton" type="button">Открыть</button>
        <button type="button">Сохранить</button>
      </div>
    </header>

    <main class="workspace">
      <div id="emptyState" class="empty-state">Изображение не открыто</div>
      <canvas id="canvas" hidden></canvas>
    </main>

    <footer class="statusbar">
      <span id="imageSize">Размер: 0 x 0</span>
      <span>Масштаб: 100%</span>
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
const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const emptyState = document.querySelector<HTMLDivElement>('#emptyState')!
const imageSize = document.querySelector<HTMLSpanElement>('#imageSize')!
const context = canvas.getContext('2d')!

function showCanvas(width: number, height: number) {
  emptyState.hidden = true
  canvas.hidden = false
  imageSize.textContent = `Размер: ${width} x ${height}`
}

function openBrowserImage(file: File) {
  const image = new Image()
  const url = URL.createObjectURL(file)

  image.onload = () => {
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    showCanvas(canvas.width, canvas.height)

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
    showCanvas(image.width, image.height)
  } catch {
    alert('Не удалось открыть файл GB7')
  }
}

openButton.addEventListener('click', () => {
  fileInput.click()
})

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]

  if (!file) {
    return
  }

  if (file.name.toLowerCase().endsWith('.gb7')) {
    await openGb7(file)
  } else {
    openBrowserImage(file)
  }

  fileInput.value = ''
})
