export type Locale = 'es' | 'en'

export const TRANSLATIONS = {
  es: {
    // Header
    'header.title': 'ParametriCAD',
    'header.subtitle': 'Generación CAD paramétrica con validación de malla',
    'header.saveProject': 'Guardar Proyecto',
    'header.openProject': 'Abrir Proyecto',
    'header.saveProjectTitle': 'Guardar proyecto CAD activo en JSON',
    'header.openProjectTitle': 'Abrir proyecto CAD desde JSON',
    'header.activeDemo': '24/7 Demo Activa',
    'header.offline': 'Sin Conexión',

    // Workspace & Sections
    'workspace.presets': 'Muestras',
    'workspace.inputs': 'Parámetros',
    'workspace.report': 'Informe',
    'workspace.downloads': 'Descargas',
    'workspace.naturalLanguage': 'Lenguaje natural',
    'workspace.parameters': 'Parámetros',

    // Quality Indicators
    'quality.valid': 'malla válida',
    'quality.degraded': 'malla degradada',
    'quality.invalid': 'malla inválida',
  },
  en: {
    // Header
    'header.title': 'ParametriCAD',
    'header.subtitle': 'Parametric CAD generation with mesh validation',
    'header.saveProject': 'Save Project',
    'header.openProject': 'Open Project',
    'header.saveProjectTitle': 'Save active CAD project to JSON',
    'header.openProjectTitle': 'Open CAD project from JSON',
    'header.activeDemo': '24/7 Demo Active',
    'header.offline': 'Offline',

    // Workspace & Sections
    'workspace.presets': 'Presets',
    'workspace.inputs': 'Parameters',
    'workspace.report': 'Report',
    'workspace.downloads': 'Downloads',
    'workspace.naturalLanguage': 'Natural language',
    'workspace.parameters': 'Parameters',

    // Quality Indicators
    'quality.valid': 'mesh valid',
    'quality.degraded': 'mesh degraded',
    'quality.invalid': 'mesh invalid',
  },
} as const

export type TranslationKey = keyof typeof TRANSLATIONS.es
