import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="editor">
    <header class="toolbar">
      <div class="toolbar-title">Photoshop</div>
      <div class="toolbar-actions">
        <button type="button">Открыть</button>
        <button type="button">Сохранить</button>
      </div>
    </header>

    <main class="workspace">
      <div class="empty-state">Изображение не открыто</div>
    </main>

    <footer class="statusbar">
      <span>Размер: 0 x 0</span>
      <span>Масштаб: 100%</span>
    </footer>
  </div>
`
