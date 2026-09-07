# ParametriCAD · Frontend

Interfaz de la generación paramétrica: formulario dirigido por esquema, visor 3D
y lectura del informe de validación de malla.

## Estructura

```
src/
  types/api.ts         Contrato de la API
  lib/
    apiClient.ts       Cliente fetch tipado, con cancelación
    catalog.ts         Catálogo -> estado de formulario -> payload
    format.ts          Formato de magnitudes de ingeniería
    hooks/             useCatalog, useGeneration, useDebouncedValue
  components/
    ui/                Primitivas (botón, campo numérico, panel, badge)
    generator/         Selector de componente, formulario, composer de prompt
    report/            Validación, propiedades, artefactos, errores
    viewer/            Canvas, cámara, luces, cotas, ciclo de vida del modelo
```

## Decisiones

**El formulario se construye desde `/api/v1/catalog`.** Cada control -- tipo,
unidad, paso, límites, valor por defecto -- procede del esquema del backend. Un
parámetro nuevo aparece sin tocar el frontend, y no hay una segunda copia de las
reglas de validación que pueda desincronizarse.

**Vista previa con debounce y cancelación.** Editar un parámetro regenera tras
350 ms de reposo. Una petición superada se aborta: sin eso, una petición lenta
podría resolverse después de otra más reciente y dejar geometría obsoleta en
pantalla. El último modelo válido sobrevive a una regeneración y a un error, para
no vaciar el visor en cada pulsación.

**Formatos bajo demanda.** La vista previa pide solo GLB. Los formatos exactos se
generan al solicitarlos, así que arrastrar un valor no paga un export STEP que
nadie ha pedido.

**Gestión explícita de memoria en el visor.** Three.js no libera búferes ni
texturas al sacar un objeto de la escena. Cada modelo se carga con su propio
`GLTFLoader` y se libera recorriendo el grafo, en lugar de usar la caché por URL
de `useGLTF`, que nunca desaloja: cada cambio de parámetro produce un modelo
nuevo y la caché crecería sin límite mientras la pestaña siga abierta.

**Iluminación con luces, no con HDRI.** Los presets de entorno descargan una
textura de varios megas desde un CDN y tiñen la superficie cuyo color real se
intenta leer. Tres luces neutras son inmediatas, funcionan sin red y no falsean
el material.

**Renderizado bajo demanda.** `frameloop="demand"`: una pieza estática no
necesita fotogramas.

## Comandos

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
```

## Configuración

| Variable       | Por defecto             | Descripción       |
| -------------- | ----------------------- | ----------------- |
| `VITE_API_URL` | `http://localhost:8000` | Origen de la API  |
