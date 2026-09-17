import './style.css'
import { decodeGb7, encodeGb7 } from './gb7'
import { getImageInfo } from './image-info'
import { createChannelView, renderChannels, type ChannelType } from './channels'
import { getPixelPosition, getPixelRgb } from './pipette'
import { rgbToLab } from './color'
import { resizeImageData, type InterpolationMethod } from './interpolation'
import { formatKernelValue, getKernelPreset, kernelPresets } from './kernels'
import {
  createHistogram,
  createLevelsPreview,
  createLevelsSettings,
  drawHistogram,
  gammaToMarkerPosition,
  markerPositionToGamma,
  renderLevelsChannels,
  type HistogramScale,
  type InputLevels,
  type LevelsChannel,
} from './levels'

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
        <button
          id="levelsButton"
          class="tool-button"
          type="button"
          disabled
          aria-label="Уровни"
          title="Уровни"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 19H21"></path>
            <path d="M4 17V14H6V11H8V13H10V8H12V10H14V6H16V12H18V9H20V17"></path>
          </svg>
        </button>
        <button
          id="resizeButton"
          class="tool-button tool-button-labeled"
          type="button"
          disabled
          aria-label="Изменить размер изображения"
          title="Изменить размер изображения"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="14" rx="1.5"></rect>
            <path d="M8 15 16 9"></path>
            <path d="M12.5 9H16V12.5"></path>
            <path d="M11.5 15H8V11.5"></path>
          </svg>
          <span>Размер</span>
        </button>
        <button
          id="filterButton"
          class="tool-button tool-button-labeled"
          type="button"
          disabled
          aria-label="Фильтрация изображения"
          title="Фильтрация изображения"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="1.5"></rect>
            <path d="M9.33 4V20M14.67 4V20M4 9.33H20M4 14.67H20"></path>
          </svg>
          <span>Фильтр</span>
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

    <dialog id="levelsDialog" class="levels-dialog">
      <div class="levels-window">
        <div class="levels-header">
          <div class="levels-title">Уровни</div>
          <button id="levelsCloseButton" class="levels-close" type="button" aria-label="Закрыть">×</button>
        </div>
        <div class="levels-controls">
          <label class="levels-field">
            <span>Канал</span>
            <select id="levelsChannel"></select>
          </label>
          <label class="levels-field">
            <span>Гистограмма</span>
            <select id="histogramScale">
              <option value="linear">Линейная</option>
              <option value="log">Логарифмическая</option>
            </select>
          </label>
        </div>
        <div class="histogram-block">
          <div class="levels-input-title">Входные уровни</div>
          <div class="levels-graph">
            <canvas id="histogramCanvas" class="histogram-canvas" width="512" height="220"></canvas>
            <div class="levels-marker-track">
              <input id="levelsBlackMarker" class="levels-marker levels-marker-black" type="range" min="0" max="255" value="0" aria-label="Точка черного" />
              <input id="levelsGammaMarker" class="levels-marker levels-marker-gamma" type="range" min="0" max="255" step="any" value="128" aria-label="Полутона" />
              <input id="levelsWhiteMarker" class="levels-marker levels-marker-white" type="range" min="0" max="255" value="255" aria-label="Точка белого" />
            </div>
          </div>
          <div class="levels-input-values">
            <label>
              <span>Черный</span>
              <input id="levelsBlackValue" type="number" min="0" max="254" value="0" />
            </label>
            <label>
              <span>Гамма</span>
              <input id="levelsGammaValue" type="number" min="0.1" max="9.9" step="0.1" value="1.0" />
            </label>
            <label>
              <span>Белый</span>
              <input id="levelsWhiteValue" type="number" min="1" max="255" value="255" />
            </label>
          </div>
          <div class="histogram-axis">
            <span>0</span>
            <span id="histogramMax">255</span>
          </div>
          <label class="levels-preview-option">
            <input id="levelsPreview" type="checkbox" checked />
            <span>Предпросмотр</span>
          </label>
        </div>
        <div class="levels-actions">
          <button id="levelsResetButton" class="levels-action levels-reset" type="button">Сброс</button>
          <div class="levels-action-group">
            <button id="levelsCancelButton" class="levels-action" type="button">Отмена</button>
            <button id="levelsApplyButton" class="levels-action levels-apply" type="button">Применить</button>
          </div>
        </div>
      </div>
    </dialog>

    <dialog id="resizeDialog" class="resize-dialog">
      <div class="resize-window">
        <div class="resize-header">
          <div class="resize-title">Размер изображения</div>
          <button id="resizeCloseButton" class="resize-close" type="button" aria-label="Закрыть">×</button>
        </div>

        <div class="resize-summary">
          <div class="resize-summary-item">
            <span>До</span>
            <strong id="resizeBeforePixels">0.00 Мп</strong>
          </div>
          <div class="resize-summary-arrow">→</div>
          <div class="resize-summary-item">
            <span>После</span>
            <strong id="resizeAfterPixels">0.00 Мп</strong>
          </div>
        </div>

        <div class="resize-fields">
          <label class="resize-field resize-field-wide">
            <span>Единицы</span>
            <select id="resizeUnit">
              <option value="pixels">Пиксели</option>
              <option value="percent">Проценты</option>
            </select>
          </label>

          <label class="resize-field">
            <span>Ширина</span>
            <div class="resize-number-field">
              <input id="resizeWidth" type="number" min="1" step="1" />
              <span id="resizeWidthUnit">px</span>
            </div>
          </label>

          <label class="resize-field">
            <span>Высота</span>
            <div class="resize-number-field">
              <input id="resizeHeight" type="number" min="1" step="1" />
              <span id="resizeHeightUnit">px</span>
            </div>
          </label>

          <label class="resize-ratio-option resize-field-wide">
            <input id="resizeKeepRatio" type="checkbox" checked />
            <span>Сохранять пропорции</span>
          </label>

          <label class="resize-field resize-field-wide">
            <span>Интерполяция</span>
            <div class="resize-method-row">
              <select id="resizeMethod">
                <option value="bilinear">Билинейная</option>
                <option value="nearest">Ближайший сосед</option>
              </select>
              <button id="resizeMethodHelp" class="resize-help" type="button" aria-label="Описание интерполяции">?</button>
              <div id="resizeMethodTooltip" class="resize-tooltip" role="tooltip"></div>
            </div>
          </label>
        </div>

        <div id="resizeError" class="resize-error" aria-live="polite"></div>

        <div class="resize-actions">
          <button id="resizeCancelButton" class="resize-action" type="button">Отмена</button>
          <button id="resizeApplyButton" class="resize-action resize-apply" type="button">Изменить</button>
        </div>
      </div>
    </dialog>

    <dialog id="filterDialog" class="filter-dialog">
      <div class="filter-window">
        <div class="filter-header">
          <div class="filter-title">Фильтрация</div>
          <button id="filterCloseIcon" class="filter-close" type="button" aria-label="Закрыть">×</button>
        </div>

        <div class="filter-layout">
          <div class="filter-main">
            <label class="filter-field">
              <span>Предустановка</span>
              <select id="kernelPreset">
                ${kernelPresets.map((preset) => `<option value="${preset.id}">${preset.name}</option>`).join('')}
                <option value="custom">Пользовательское</option>
              </select>
            </label>

            <div class="kernel-section">
              <div class="filter-section-title">Ядро 3×3</div>
              <div id="kernelGrid" class="kernel-grid">
                ${Array.from({ length: 9 }, (_, index) => `<input class="kernel-value" type="number" step="any" value="${index === 4 ? 1 : 0}" aria-label="Коэффициент ядра ${index + 1}" />`).join('')}
              </div>
            </div>
          </div>

          <div class="filter-options">
            <fieldset class="filter-group">
              <legend>Каналы</legend>
              <div id="filterChannels" class="filter-channels"></div>
            </fieldset>

            <label class="filter-field">
              <span>Обработка краёв</span>
              <select id="edgeHandling">
                <option value="black">Заполнение чёрным</option>
                <option value="white">Заполнение белым</option>
                <option value="copy">Копирование</option>
              </select>
            </label>

            <label class="filter-preview-option">
              <input id="filterPreview" type="checkbox" checked />
              <span>Предпросмотр</span>
            </label>
          </div>
        </div>

        <div id="filterError" class="filter-error" aria-live="polite"></div>

        <div class="filter-actions">
          <button id="filterResetButton" class="filter-action filter-reset" type="button">Сбросить</button>
          <div class="filter-action-group">
            <button id="filterCloseButton" class="filter-action" type="button">Закрыть</button>
            <button id="filterApplyButton" class="filter-action filter-apply" type="button">Применить</button>
          </div>
        </div>
      </div>
    </dialog>

    <footer class="statusbar">
      <span id="imageWidth">Ширина: 0 px</span>
      <span id="imageHeight">Высота: 0 px</span>
      <span id="colorDepth">Глубина цвета: -</span>
      <label class="view-scale-control">
        <span>Масштаб:</span>
        <input id="viewScale" type="range" min="12" max="300" value="100" disabled />
        <span id="viewScaleValue">100%</span>
      </label>
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
const levelsButton = document.querySelector<HTMLButtonElement>('#levelsButton')!
const resizeButton = document.querySelector<HTMLButtonElement>('#resizeButton')!
const filterButton = document.querySelector<HTMLButtonElement>('#filterButton')!
const saveFormat = document.querySelector<HTMLSelectElement>('#saveFormat')!
const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const workspace = document.querySelector<HTMLElement>('.workspace')!
const emptyState = document.querySelector<HTMLDivElement>('#emptyState')!
const imageWidth = document.querySelector<HTMLSpanElement>('#imageWidth')!
const imageHeight = document.querySelector<HTMLSpanElement>('#imageHeight')!
const colorDepth = document.querySelector<HTMLSpanElement>('#colorDepth')!
const viewScale = document.querySelector<HTMLInputElement>('#viewScale')!
const viewScaleValue = document.querySelector<HTMLSpanElement>('#viewScaleValue')!
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
const levelsDialog = document.querySelector<HTMLDialogElement>('#levelsDialog')!
const levelsCloseButton = document.querySelector<HTMLButtonElement>('#levelsCloseButton')!
const levelsChannel = document.querySelector<HTMLSelectElement>('#levelsChannel')!
const histogramScale = document.querySelector<HTMLSelectElement>('#histogramScale')!
const histogramCanvas = document.querySelector<HTMLCanvasElement>('#histogramCanvas')!
const histogramMax = document.querySelector<HTMLSpanElement>('#histogramMax')!
const levelsBlackMarker = document.querySelector<HTMLInputElement>('#levelsBlackMarker')!
const levelsGammaMarker = document.querySelector<HTMLInputElement>('#levelsGammaMarker')!
const levelsWhiteMarker = document.querySelector<HTMLInputElement>('#levelsWhiteMarker')!
const levelsBlackValue = document.querySelector<HTMLInputElement>('#levelsBlackValue')!
const levelsGammaValue = document.querySelector<HTMLInputElement>('#levelsGammaValue')!
const levelsWhiteValue = document.querySelector<HTMLInputElement>('#levelsWhiteValue')!
const levelsPreview = document.querySelector<HTMLInputElement>('#levelsPreview')!
const levelsResetButton = document.querySelector<HTMLButtonElement>('#levelsResetButton')!
const levelsCancelButton = document.querySelector<HTMLButtonElement>('#levelsCancelButton')!
const levelsApplyButton = document.querySelector<HTMLButtonElement>('#levelsApplyButton')!
const resizeDialog = document.querySelector<HTMLDialogElement>('#resizeDialog')!
const resizeCloseButton = document.querySelector<HTMLButtonElement>('#resizeCloseButton')!
const resizeBeforePixels = document.querySelector<HTMLElement>('#resizeBeforePixels')!
const resizeAfterPixels = document.querySelector<HTMLElement>('#resizeAfterPixels')!
const resizeUnit = document.querySelector<HTMLSelectElement>('#resizeUnit')!
const resizeWidth = document.querySelector<HTMLInputElement>('#resizeWidth')!
const resizeHeight = document.querySelector<HTMLInputElement>('#resizeHeight')!
const resizeWidthUnit = document.querySelector<HTMLSpanElement>('#resizeWidthUnit')!
const resizeHeightUnit = document.querySelector<HTMLSpanElement>('#resizeHeightUnit')!
const resizeKeepRatio = document.querySelector<HTMLInputElement>('#resizeKeepRatio')!
const resizeMethod = document.querySelector<HTMLSelectElement>('#resizeMethod')!
const resizeMethodTooltip = document.querySelector<HTMLDivElement>('#resizeMethodTooltip')!
const resizeError = document.querySelector<HTMLDivElement>('#resizeError')!
const resizeCancelButton = document.querySelector<HTMLButtonElement>('#resizeCancelButton')!
const resizeApplyButton = document.querySelector<HTMLButtonElement>('#resizeApplyButton')!
const filterDialog = document.querySelector<HTMLDialogElement>('#filterDialog')!
const filterCloseIcon = document.querySelector<HTMLButtonElement>('#filterCloseIcon')!
const kernelPreset = document.querySelector<HTMLSelectElement>('#kernelPreset')!
const kernelInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.kernel-value'))
const filterChannels = document.querySelector<HTMLDivElement>('#filterChannels')!
const edgeHandling = document.querySelector<HTMLSelectElement>('#edgeHandling')!
const filterPreview = document.querySelector<HTMLInputElement>('#filterPreview')!
const filterError = document.querySelector<HTMLDivElement>('#filterError')!
const filterResetButton = document.querySelector<HTMLButtonElement>('#filterResetButton')!
const filterCloseButton = document.querySelector<HTMLButtonElement>('#filterCloseButton')!
const filterApplyButton = document.querySelector<HTMLButtonElement>('#filterApplyButton')!
const context = canvas.getContext('2d')!

let currentFileName = 'image'
let currentImageData: ImageData | null = null
let currentChannels: ChannelType[] = []
let activeChannels = new Set<ChannelType>()
let pipetteActive = false
let pipetteDragging = false
let currentLevelsMax = 255
let levelsSettings = new Map<LevelsChannel, InputLevels>()
let levelsPreviewFrame = 0
let currentViewScale = 100
let viewRenderFrame = 0
let resizeUnitMode: 'pixels' | 'percent' = 'pixels'
let resizeSyncing = false
let filterSelectedChannels = new Set<ChannelType>()

function getFilterChannelName(channel: ChannelType) {
  const names: Record<ChannelType, string> = {
    gray: 'Серый',
    red: 'Красный',
    green: 'Зелёный',
    blue: 'Синий',
    alpha: 'Альфа',
    mask: 'Маска',
  }

  return names[channel]
}

function fillKernelInputs(presetId: string) {
  const preset = getKernelPreset(presetId)

  kernelInputs.forEach((input, index) => {
    input.value = formatKernelValue(preset.values[index])
  })

  filterError.textContent = ''
  filterApplyButton.disabled = false
}

function validateKernelInputs() {
  const valid = kernelInputs.every((input) => Number.isFinite(Number(input.value)) && input.value.trim() !== '')

  if (!valid) {
    filterError.textContent = 'Все 9 коэффициентов ядра должны быть числами.'
    filterApplyButton.disabled = true
    return false
  }

  if (filterSelectedChannels.size === 0) {
    filterError.textContent = 'Выберите хотя бы один канал.'
    filterApplyButton.disabled = true
    return false
  }

  filterError.textContent = ''
  filterApplyButton.disabled = false
  return true
}

function renderFilterChannels() {
  filterChannels.replaceChildren()
  filterSelectedChannels = new Set(currentChannels)

  for (const channel of currentChannels) {
    const label = document.createElement('label')
    const input = document.createElement('input')
    const text = document.createElement('span')

    label.className = 'filter-channel-option'
    input.type = 'checkbox'
    input.checked = true
    input.value = channel
    text.textContent = getFilterChannelName(channel)

    input.addEventListener('change', () => {
      if (input.checked) {
        filterSelectedChannels.add(channel)
      } else {
        filterSelectedChannels.delete(channel)
      }

      validateKernelInputs()
    })

    label.append(input, text)
    filterChannels.append(label)
  }
}

function resetFilterDialog() {
  kernelPreset.value = 'identity'
  fillKernelInputs('identity')
  edgeHandling.value = 'black'
  filterPreview.checked = true
  renderFilterChannels()
  validateKernelInputs()
}

function openFilterDialog() {
  if (!currentImageData) {
    return
  }

  setPipetteActive(false)
  resetFilterDialog()
  filterDialog.showModal()
}

function closeFilterDialog() {
  filterDialog.close()
}

function acceptFilterSettings() {
  if (!validateKernelInputs()) {
    return
  }

  filterDialog.close()
}

function formatLabValue(value: number) {
  return Math.abs(value) < 0.005 ? '0.00' : value.toFixed(2)
}

function formatMegapixels(width: number, height: number) {
  return `${(width * height / 1_000_000).toFixed(2)} Мп`
}

function getResizeTarget(unit = resizeUnitMode) {
  if (!currentImageData) {
    return null
  }

  const widthValue = Number(resizeWidth.value)
  const heightValue = Number(resizeHeight.value)

  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue)) {
    return null
  }

  if (unit === 'percent') {
    return {
      width: Math.max(1, Math.round(currentImageData.width * widthValue / 100)),
      height: Math.max(1, Math.round(currentImageData.height * heightValue / 100)),
    }
  }

  return {
    width: Math.round(widthValue),
    height: Math.round(heightValue),
  }
}

function validateResizeInputs() {
  if (!currentImageData) {
    resizeApplyButton.disabled = true
    return false
  }

  const widthValue = Number(resizeWidth.value)
  const heightValue = Number(resizeHeight.value)
  const maxInput = resizeUnitMode === 'pixels' ? 20000 : 1000
  const unitName = resizeUnitMode === 'pixels' ? 'пикселей' : 'процентов'

  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
    resizeError.textContent = 'Ширина и высота должны быть больше нуля.'
    resizeApplyButton.disabled = true
    return false
  }

  if (widthValue > maxInput || heightValue > maxInput) {
    resizeError.textContent = `Максимальное значение: ${maxInput} ${unitName}.`
    resizeApplyButton.disabled = true
    return false
  }

  const target = getResizeTarget()

  if (!target || target.width > 20000 || target.height > 20000) {
    resizeError.textContent = 'Итоговая ширина и высота не должны превышать 20000 px.'
    resizeApplyButton.disabled = true
    return false
  }

  if (target.width * target.height > 100_000_000) {
    resizeError.textContent = 'Итоговый размер не должен превышать 100 мегапикселей.'
    resizeApplyButton.disabled = true
    return false
  }

  resizeError.textContent = ''
  resizeApplyButton.disabled = false
  resizeAfterPixels.textContent = formatMegapixels(target.width, target.height)
  return true
}

function syncResizeFromWidth() {
  if (!currentImageData || resizeSyncing || !resizeKeepRatio.checked) {
    validateResizeInputs()
    return
  }

  const value = Number(resizeWidth.value)

  if (!Number.isFinite(value) || value <= 0) {
    validateResizeInputs()
    return
  }

  resizeSyncing = true
  resizeHeight.value = resizeUnitMode === 'percent'
    ? String(value)
    : String(Math.max(1, Math.round(value * currentImageData.height / currentImageData.width)))
  resizeSyncing = false
  validateResizeInputs()
}

function syncResizeFromHeight() {
  if (!currentImageData || resizeSyncing || !resizeKeepRatio.checked) {
    validateResizeInputs()
    return
  }

  const value = Number(resizeHeight.value)

  if (!Number.isFinite(value) || value <= 0) {
    validateResizeInputs()
    return
  }

  resizeSyncing = true
  resizeWidth.value = resizeUnitMode === 'percent'
    ? String(value)
    : String(Math.max(1, Math.round(value * currentImageData.width / currentImageData.height)))
  resizeSyncing = false
  validateResizeInputs()
}

function updateResizeMethodTooltip() {
  const descriptions: Record<InterpolationMethod, string> = {
    bilinear: 'Билинейная интерполяция сглаживает переходы между пикселями и обычно лучше подходит для фотографий.',
    nearest: 'Ближайший сосед работает быстрее и сохраняет резкие границы, что удобно для пиксельной графики.',
  }

  resizeMethodTooltip.textContent = descriptions[resizeMethod.value as InterpolationMethod]
}

function changeResizeUnit() {
  if (!currentImageData) {
    return
  }

  const target = getResizeTarget(resizeUnitMode) ?? {
    width: currentImageData.width,
    height: currentImageData.height,
  }
  resizeUnitMode = resizeUnit.value as 'pixels' | 'percent'
  const isPercent = resizeUnitMode === 'percent'

  resizeWidthUnit.textContent = isPercent ? '%' : 'px'
  resizeHeightUnit.textContent = isPercent ? '%' : 'px'
  resizeWidth.step = isPercent ? '0.1' : '1'
  resizeHeight.step = isPercent ? '0.1' : '1'
  resizeWidth.max = isPercent ? '1000' : '20000'
  resizeHeight.max = isPercent ? '1000' : '20000'

  if (isPercent) {
    resizeWidth.value = (target.width / currentImageData.width * 100).toFixed(1)
    resizeHeight.value = (target.height / currentImageData.height * 100).toFixed(1)
  } else {
    resizeWidth.value = String(target.width)
    resizeHeight.value = String(target.height)
  }

  validateResizeInputs()
}

function openResizeDialog() {
  if (!currentImageData) {
    return
  }

  setPipetteActive(false)
  resizeUnitMode = 'pixels'
  resizeUnit.value = 'pixels'
  resizeWidth.value = String(currentImageData.width)
  resizeHeight.value = String(currentImageData.height)
  resizeWidthUnit.textContent = 'px'
  resizeHeightUnit.textContent = 'px'
  resizeWidth.step = '1'
  resizeHeight.step = '1'
  resizeWidth.max = '20000'
  resizeHeight.max = '20000'
  resizeKeepRatio.checked = true
  resizeMethod.value = 'bilinear'
  resizeBeforePixels.textContent = formatMegapixels(currentImageData.width, currentImageData.height)
  updateResizeMethodTooltip()
  validateResizeInputs()
  resizeDialog.showModal()
}

function keepBinaryMask(imageData: ImageData) {
  if (!currentChannels.includes('mask')) {
    return imageData
  }

  const pixels = new Uint8ClampedArray(imageData.data)

  for (let index = 3; index < pixels.length; index += 4) {
    pixels[index] = pixels[index] >= 128 ? 255 : 0
  }

  return new ImageData(pixels, imageData.width, imageData.height)
}

function applyResize() {
  if (!currentImageData || !validateResizeInputs()) {
    return
  }

  const target = getResizeTarget()

  if (!target) {
    return
  }

  const method = resizeMethod.value as InterpolationMethod
  const resized = resizeImageData(currentImageData, target.width, target.height, method)

  currentImageData = keepBinaryMask(resized)
  imageWidth.textContent = `Ширина: ${currentImageData.width} px`
  imageHeight.textContent = `Высота: ${currentImageData.height} px`
  resetPipetteInfo()
  renderCurrentImage()
  renderChannelsPanel()
  resizeDialog.close()
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

  const position = getPixelPosition(
    event,
    canvas,
    currentImageData.width,
    currentImageData.height,
  )

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

function updateLevelsHistogram() {
  if (!currentImageData) {
    return
  }

  const histogram = createHistogram(
    currentImageData,
    levelsChannel.value as LevelsChannel,
    currentLevelsMax,
  )

  drawHistogram(
    histogramCanvas,
    histogram,
    histogramScale.value as HistogramScale,
  )
}

function getCurrentLevelsSettings() {
  return levelsSettings.get(levelsChannel.value as LevelsChannel)
}

function updateLevelsInputs() {
  const settings = getCurrentLevelsSettings()

  if (!settings) {
    return
  }

  const gammaPosition = gammaToMarkerPosition(settings)

  levelsBlackMarker.max = String(currentLevelsMax)
  levelsGammaMarker.max = String(currentLevelsMax)
  levelsWhiteMarker.max = String(currentLevelsMax)
  levelsBlackMarker.value = String(settings.black)
  levelsGammaMarker.value = String(gammaPosition)
  levelsWhiteMarker.value = String(settings.white)

  levelsBlackValue.max = String(Math.max(0, settings.white - 1))
  levelsWhiteValue.min = String(Math.min(currentLevelsMax, settings.black + 1))
  levelsWhiteValue.max = String(currentLevelsMax)
  levelsBlackValue.value = String(settings.black)
  levelsGammaValue.value = settings.gamma.toFixed(2)
  levelsWhiteValue.value = String(settings.white)
}

function renderImageAtCurrentScale(imageData: ImageData) {
  const width = Math.max(1, Math.round(imageData.width * currentViewScale / 100))
  const height = Math.max(1, Math.round(imageData.height * currentViewScale / 100))
  const scaled = resizeImageData(imageData, width, height, 'bilinear')

  canvas.width = scaled.width
  canvas.height = scaled.height
  context.putImageData(scaled, 0, 0)
}

function renderLevelsPreview() {
  if (!currentImageData) {
    return
  }

  if (!levelsPreview.checked) {
    renderCurrentImage()
    return
  }

  const preview = createLevelsPreview(
    currentImageData,
    currentChannels,
    levelsSettings,
    currentLevelsMax,
  )
  const visiblePreview = createChannelView(preview, currentChannels, activeChannels)

  renderImageAtCurrentScale(visiblePreview)
}

function scheduleLevelsPreview() {
  cancelAnimationFrame(levelsPreviewFrame)
  levelsPreviewFrame = requestAnimationFrame(renderLevelsPreview)
}

function changeBlackPoint(value: number) {
  const settings = getCurrentLevelsSettings()

  if (!settings) {
    return
  }

  settings.black = Math.max(0, Math.min(Math.round(value), settings.white - 1))
  updateLevelsInputs()
  scheduleLevelsPreview()
}

function changeWhitePoint(value: number) {
  const settings = getCurrentLevelsSettings()

  if (!settings) {
    return
  }

  settings.white = Math.min(currentLevelsMax, Math.max(Math.round(value), settings.black + 1))
  updateLevelsInputs()
  scheduleLevelsPreview()
}

function changeGamma(value: number) {
  const settings = getCurrentLevelsSettings()

  if (!settings) {
    return
  }

  settings.gamma = Math.min(9.9, Math.max(0.1, value))
  updateLevelsInputs()
  scheduleLevelsPreview()
}

function changeGammaMarker(position: number) {
  const settings = getCurrentLevelsSettings()

  if (!settings) {
    return
  }

  const minPosition = settings.black + 0.001
  const maxPosition = settings.white - 0.001
  const safePosition = Math.min(maxPosition, Math.max(minPosition, position))

  settings.gamma = markerPositionToGamma(safePosition, settings.black, settings.white)
  updateLevelsInputs()
  scheduleLevelsPreview()
}

function openLevels() {
  if (!currentImageData) {
    return
  }

  setPipetteActive(false)
  renderLevelsChannels(levelsChannel, currentChannels)
  levelsSettings = createLevelsSettings(currentChannels, currentLevelsMax)
  levelsChannel.value = 'master'
  histogramScale.value = 'linear'
  levelsPreview.checked = true
  histogramMax.textContent = String(currentLevelsMax)
  updateLevelsHistogram()
  updateLevelsInputs()
  levelsDialog.showModal()
}

function resetLevels() {
  levelsSettings = createLevelsSettings(currentChannels, currentLevelsMax)
  updateLevelsInputs()
  scheduleLevelsPreview()
}

function applyLevels() {
  if (!currentImageData) {
    return
  }

  cancelAnimationFrame(levelsPreviewFrame)
  currentImageData = createLevelsPreview(
    currentImageData,
    currentChannels,
    levelsSettings,
    currentLevelsMax,
  )
  resetPipetteInfo()
  renderCurrentImage()
  renderChannelsPanel()
  levelsDialog.close()
}

function renderCurrentImage() {
  if (!currentImageData) {
    return
  }

  const visibleImage = createChannelView(currentImageData, currentChannels, activeChannels)
  renderImageAtCurrentScale(visibleImage)
}

function updateViewScale(value: number) {
  currentViewScale = Math.min(300, Math.max(12, Math.round(value)))
  viewScale.value = String(currentViewScale)
  viewScaleValue.textContent = `${currentViewScale}%`
}

function fitImageToWorkspace() {
  if (!currentImageData) {
    return
  }

  const availableWidth = Math.max(1, workspace.clientWidth - 100)
  const availableHeight = Math.max(1, workspace.clientHeight - 100)
  const widthScale = availableWidth / currentImageData.width * 100
  const heightScale = availableHeight / currentImageData.height * 100

  updateViewScale(Math.floor(Math.min(widthScale, heightScale)))
}

function scheduleViewRender() {
  cancelAnimationFrame(viewRenderFrame)
  viewRenderFrame = requestAnimationFrame(renderCurrentImage)
}

function renderChannelsPanel() {
  if (!currentImageData) {
    return
  }

  renderChannels(channelsList, currentImageData, currentChannels, activeChannels, (channel, active) => {
    if (active) {
      activeChannels.add(channel)
    } else {
      activeChannels.delete(channel)
    }

    renderCurrentImage()
  })
}

function showCanvas(width: number, height: number, depth: string, channels: ChannelType[], levelsMax = 255) {
  emptyState.hidden = true
  canvas.hidden = false
  channelsPanel.hidden = false
  saveButton.disabled = false
  pipetteButton.disabled = false
  levelsButton.disabled = false
  resizeButton.disabled = false
  filterButton.disabled = false
  viewScale.disabled = false
  resetPipetteInfo()
  imageWidth.textContent = `Ширина: ${width} px`
  imageHeight.textContent = `Высота: ${height} px`
  colorDepth.textContent = `Глубина цвета: ${depth}`
  currentChannels = channels
  currentLevelsMax = levelsMax
  activeChannels = new Set(channels)

  if (currentImageData) {
    fitImageToWorkspace()
    renderCurrentImage()
    renderChannelsPanel()
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
    const sourceCanvas = document.createElement('canvas')
    const sourceContext = sourceCanvas.getContext('2d')!

    sourceCanvas.width = image.naturalWidth
    sourceCanvas.height = image.naturalHeight
    sourceContext.drawImage(image, 0, 0)

    currentImageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
    const info = await getImageInfo(file)
    showCanvas(currentImageData.width, currentImageData.height, info.depth, info.channels)
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

    currentImageData = image.data
    const channels: ChannelType[] = image.hasMask ? ['gray', 'mask'] : ['gray']
    showCanvas(image.width, image.height, image.hasMask ? '7 бит + маска' : '7 бит', channels, 127)
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

levelsButton.addEventListener('click', openLevels)
resizeButton.addEventListener('click', openResizeDialog)
filterButton.addEventListener('click', openFilterDialog)
levelsCloseButton.addEventListener('click', () => levelsDialog.close())
levelsCancelButton.addEventListener('click', () => levelsDialog.close())
levelsResetButton.addEventListener('click', resetLevels)
levelsApplyButton.addEventListener('click', applyLevels)
levelsDialog.addEventListener('close', () => {
  cancelAnimationFrame(levelsPreviewFrame)
  renderCurrentImage()
})
levelsChannel.addEventListener('change', () => {
  updateLevelsHistogram()
  updateLevelsInputs()
})
histogramScale.addEventListener('change', updateLevelsHistogram)
levelsBlackMarker.addEventListener('input', () => changeBlackPoint(Number(levelsBlackMarker.value)))
levelsWhiteMarker.addEventListener('input', () => changeWhitePoint(Number(levelsWhiteMarker.value)))
levelsGammaMarker.addEventListener('input', () => changeGammaMarker(Number(levelsGammaMarker.value)))
levelsBlackValue.addEventListener('change', () => changeBlackPoint(Number(levelsBlackValue.value)))
levelsWhiteValue.addEventListener('change', () => changeWhitePoint(Number(levelsWhiteValue.value)))
levelsGammaValue.addEventListener('change', () => changeGamma(Number(levelsGammaValue.value)))
levelsPreview.addEventListener('change', scheduleLevelsPreview)
viewScale.addEventListener('input', () => {
  updateViewScale(Number(viewScale.value))
  scheduleViewRender()
})
resizeCloseButton.addEventListener('click', () => resizeDialog.close())
resizeCancelButton.addEventListener('click', () => resizeDialog.close())
resizeUnit.addEventListener('change', changeResizeUnit)
resizeWidth.addEventListener('input', syncResizeFromWidth)
resizeHeight.addEventListener('input', syncResizeFromHeight)
resizeKeepRatio.addEventListener('change', () => {
  if (resizeKeepRatio.checked) {
    syncResizeFromWidth()
  } else {
    validateResizeInputs()
  }
})
resizeMethod.addEventListener('change', updateResizeMethodTooltip)
resizeApplyButton.addEventListener('click', applyResize)
filterCloseIcon.addEventListener('click', closeFilterDialog)
filterCloseButton.addEventListener('click', closeFilterDialog)
filterResetButton.addEventListener('click', resetFilterDialog)
filterApplyButton.addEventListener('click', acceptFilterSettings)
kernelPreset.addEventListener('change', () => {
  if (kernelPreset.value !== 'custom') {
    fillKernelInputs(kernelPreset.value)
  }

  validateKernelInputs()
})

for (const input of kernelInputs) {
  input.addEventListener('input', () => {
    kernelPreset.value = 'custom'
    validateKernelInputs()
  })
}

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
