export type KernelPresetId = 'identity' | 'sharpen' | 'gaussian' | 'box-blur' | 'prewitt-x' | 'prewitt-y'

export type EdgeHandling = 'black' | 'white' | 'copy'

export type KernelPreset = {
  id: KernelPresetId
  name: string
  values: readonly number[]
}

export const kernelPresets: readonly KernelPreset[] = [
  {
    id: 'identity',
    name: 'Тождественное отображение',
    values: [
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ],
  },
  {
    id: 'sharpen',
    name: 'Повышение резкости',
    values: [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ],
  },
  {
    id: 'gaussian',
    name: 'Фильтр Гаусса 3×3',
    values: [
      1 / 16, 2 / 16, 1 / 16,
      2 / 16, 4 / 16, 2 / 16,
      1 / 16, 2 / 16, 1 / 16,
    ],
  },
  {
    id: 'box-blur',
    name: 'Прямоугольное размытие',
    values: [
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
    ],
  },
  {
    id: 'prewitt-x',
    name: 'Оператор Прюитта X',
    values: [
      -1, 0, 1,
      -1, 0, 1,
      -1, 0, 1,
    ],
  },
  {
    id: 'prewitt-y',
    name: 'Оператор Прюитта Y',
    values: [
      -1, -1, -1,
      0, 0, 0,
      1, 1, 1,
    ],
  },
]

export function getKernelPreset(id: string) {
  return kernelPresets.find((preset) => preset.id === id) ?? kernelPresets[0]
}

export function formatKernelValue(value: number) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(6)))
}
