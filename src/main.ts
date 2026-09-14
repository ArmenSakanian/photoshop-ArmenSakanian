import './style.css'

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
      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
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

openButton.addEventListener('click', () => {
  fileInput.click()
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]

  if (!file) {
    return
  }

  const image = new Image()
  const url = URL.createObjectURL(file)

  image.onload = () => {
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)

    emptyState.hidden = true
    canvas.hidden = false
    imageSize.textContent = `Размер: ${canvas.width} x ${canvas.height}`

    URL.revokeObjectURL(url)
  }

  image.src = url
})