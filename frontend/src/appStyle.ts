export type AppStyle =
  | 'hybrid'
  | 'liquid'
  | 'glass'
  | 'bento'
  | 'youtube'
  | 'linear'
  | 'arc'
  | 'material'
  | 'cyber'
  | 'mono'
  | 'frost'
  | 'oled'

export type AppStyleOption = {
  value: AppStyle
  label: string
  shortLabel: string
  description: string
  colors: [string, string, string]
}

export const appStyleOptions: AppStyleOption[] = [
  {
    value: 'hybrid',
    label: 'Dark Liquid Glass / Bento YouTube',
    shortLabel: 'Liquid Bento',
    description: 'Le style actuel : lisible, premium, verre sombre et structure Bento.',
    colors: ['#0a0b10', '#7d7cff', '#ff4655'],
  },
  {
    value: 'liquid',
    label: 'iOS / macOS Liquid Glass',
    shortLabel: 'Liquid Glass',
    description: 'Verre plus lumineux, transparence, reflets et profondeur façon Apple.',
    colors: ['#10131c', '#8da4ff', '#dbe5ff'],
  },
  {
    value: 'glass',
    label: 'Glassmorphism Dark',
    shortLabel: 'Glassmorphism',
    description: 'Cartes translucides, flou doux et accents froids plus présents.',
    colors: ['#091019', '#5f7cff', '#5eead4'],
  },
  {
    value: 'bento',
    label: 'Bento UI',
    shortLabel: 'Bento UI',
    description: 'Blocs contrastés et structurés, inspirés des interfaces Bento modernes.',
    colors: ['#0b0c10', '#f3f4f6', '#ff6b6b'],
  },
  {
    value: 'youtube',
    label: 'YouTube Studio Premium',
    shortLabel: 'YouTube Studio',
    description: 'Noir YouTube, rouge net et surfaces denses orientées données.',
    colors: ['#0f0f0f', '#272727', '#ff0033'],
  },
  {
    value: 'linear',
    label: 'Linear / Vercel',
    shortLabel: 'Linear',
    description: 'Ultra propre et professionnel, gris froids et contraste précis.',
    colors: ['#09090b', '#18181b', '#8b8cff'],
  },
  {
    value: 'arc',
    label: 'Discord / Arc',
    shortLabel: 'Discord / Arc',
    description: 'Interface plus vivante, panneaux arrondis et accent violet.',
    colors: ['#11131a', '#5865f2', '#b4a7ff'],
  },
  {
    value: 'material',
    label: 'Material You / Material 3',
    shortLabel: 'Material You',
    description: 'Surfaces douces, gros arrondis et accent coloré plus chaleureux.',
    colors: ['#111318', '#7d5260', '#ffb1c0'],
  },
  {
    value: 'cyber',
    label: 'Cyber / Neon',
    shortLabel: 'Cyber Neon',
    description: 'Noir, néons violet/cyan et glow plus spectaculaire.',
    colors: ['#04050a', '#9d4edd', '#00f5d4'],
  },
  {
    value: 'mono',
    label: 'Monochrome Premium',
    shortLabel: 'Monochrome',
    description: 'Noir, blanc et gris uniquement, avec un rendu très haut de gamme.',
    colors: ['#050505', '#202020', '#f2f2f2'],
  },
  {
    value: 'frost',
    label: 'Frost / Nordic',
    shortLabel: 'Frost Blue',
    description: 'Bleu ardoise froid, cyan léger et contraste calme et professionnel.',
    colors: ['#0b1118', '#34516f', '#82d9f5'],
  },
  {
    value: 'oled',
    label: 'OLED / Emerald',
    shortLabel: 'OLED Emerald',
    description: 'Noir profond, accent émeraude et contraste maximal pensé pour l’OLED.',
    colors: ['#020403', '#0f2d23', '#42d99c'],
  },
]

const STORAGE_KEY = 'ytm.appStyle'

export function getAppStyle(): AppStyle {
  const saved = localStorage.getItem(STORAGE_KEY) as AppStyle | null
  return appStyleOptions.some((option) => option.value === saved) ? saved! : 'linear'
}

export function applyAppStyle(value: AppStyle) {
  document.documentElement.dataset.appStyle = value
}

export function setAppStyle(value: AppStyle) {
  localStorage.setItem(STORAGE_KEY, value)
  applyAppStyle(value)
}

export function initializeAppStyle() {
  applyAppStyle(getAppStyle())
}
