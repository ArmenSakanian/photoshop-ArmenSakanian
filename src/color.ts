export type LabColor = {
  l: number
  a: number
  b: number
}

function toLinear(value: number) {
  const channel = value / 255
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function labFunction(value: number) {
  const delta = 6 / 29
  const limit = delta ** 3

  if (value > limit) {
    return Math.cbrt(value)
  }

  return value / (3 * delta ** 2) + 4 / 29
}

export function rgbToLab(r: number, g: number, b: number): LabColor {
  const red = toLinear(r)
  const green = toLinear(g)
  const blue = toLinear(b)

  const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / 0.95047
  const y = 0.2126729 * red + 0.7151522 * green + 0.072175 * blue
  const z = (0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / 1.08883

  const fx = labFunction(x)
  const fy = labFunction(y)
  const fz = labFunction(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}
