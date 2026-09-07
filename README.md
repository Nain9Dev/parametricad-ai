# ParametriCAD AI

Motor de generación paramétrica de componentes CAD con validación geométrica
determinista y visor 3D web.

El sistema construye sólidos exactos (B-Rep) con OpenCASCADE, los teselá a malla,
somete esa malla a un control de calidad geométrico completo (estanqueidad,
manifold, orientación de normales, auto-intersecciones, topología) y publica los
artefactos en cinco formatos. Los parámetros pueden introducirse directamente o
extraerse de una descripción en lenguaje natural.

## Demo

- **Frontend:** [parametricad.naindev.com](https://parametricad.naindev.com)
- **API:** `https://api.parametricad.naindev.com`

Prompt de ejemplo:

> *Generate a stainless steel pipe with a diameter of 25.5mm and a length of 200mm*

## Arquitectura

Arquitectura hexagonal: el núcleo geométrico no conoce HTTP, no toca disco y no
depende del kernel CAD.

```
backend/app/
  domain/          Núcleo puro: sin I/O, sin kernel, sin estado global
    geometry/      Algoritmos de malla (topología, auto-intersección, métricas)
    models/        Especificaciones Pydantic, artefactos, resultados
    ports/         Protocolos que la infraestructura implementa
    errors.py      Jerarquía de errores con códigos estables
  application/     Orquestación del pipeline y catálogo de capacidades
  infrastructure/  Adaptadores: CadQuery, trimesh, Groq, filesystem, FastAPI
```

**Decisión clave:** el análisis de malla vive en el dominio, no en un adaptador.
Es la parte que aporta valor y la que debe ser verificable sin arrancar un kernel
CAD; delegarla en la librería de mallas de turno haría imposible razonar sobre
sus invariantes.

### Componentes soportados

| Componente | Parámetros                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| `pipe`     | diámetro exterior, espesor de pared, longitud                               |
| `elbow`    | diámetro, espesor, radio de curvatura, ángulo, tramos rectos tangentes      |
| `flange`   | diámetro exterior, paso, espesor, número/diámetro/círculo de pernos         |
| `plate`    | ancho, fondo, espesor, radio de esquina, agujero central                    |

Las reglas de validación cruzada codifican fabricabilidad, no solo positividad:
una pared más gruesa que el radio, un radio de curvatura que pliega el tubo sobre
su propio eje o un círculo de pernos que se sale del ala se rechazan **antes** de
llegar al kernel.

### Formatos de exportación

| Formato | Origen | Uso                                        |
| ------- | ------ | ------------------------------------------ |
| GLB     | Malla  | Visor web                                  |
| glTF    | Malla  | Intercambio con buffers embebidos          |
| STL     | Malla  | Fabricación aditiva                        |
| STEP    | B-Rep  | Geometría exacta para CAD aguas abajo      |
| DXF     | B-Rep  | Sección 2D para planos y corte             |

La distinción malla/exacto es visible en la interfaz y en la API: no son
intercambiables.

## Determinismo

La misma especificación produce siempre la misma malla, bit a bit. Esto sostiene
el direccionamiento por contenido: `model_id` es un digest de la especificación
canónica, los ajustes de teselado y la revisión del motor, de modo que repetir
unos parámetros reutiliza los artefactos en lugar de reconstruirlos.

Excepción documentada: los ficheros STEP incorporan una marca temporal de
exportación y un contador de sesión propios de OpenCASCADE. La geometría es
idéntica; las cabeceras no. Por eso la dirección del artefacto se deriva de la
especificación y no de los bytes exportados.

## API

| Endpoint                 | Descripción                                          |
| ------------------------ | ---------------------------------------------------- |
| `GET  /health`           | Estado y adaptadores activos                         |
| `GET  /api/v1/catalog`   | Componentes, parámetros, límites, materiales, formatos |
| `POST /api/v1/models`    | Generación desde especificación explícita            |
| `POST /api/v1/generate`  | Generación desde descripción en lenguaje natural     |
| `GET  /static/models/...`| Artefactos generados (inmutables, cacheables)        |

El catálogo se deriva del esquema JSON de los modelos Pydantic. El formulario del
frontend se construye a partir de él, así que añadir un parámetro en el backend
lo hace aparecer en la interfaz sin tocar el frontend.

Todos los fallos comparten el mismo sobre:

```json
{
  "error": {
    "code": "invalid_parameters",
    "message": "The request does not describe a buildable component.",
    "hint": "Check the field names and the dimensional limits in /api/v1/catalog.",
    "details": { "violations": [ { "field": "spec.pipe", "message": "..." } ] }
  }
}
```

## Extracción de parámetros

Dos backends intercambiables tras el mismo puerto:

- **`rule_based`** (por defecto): determinista, sin red ni clave de API. Reconoce
  español e inglés, ambos órdenes de palabras, separadores decimales de coma o
  punto y conversión de unidades (mm, cm, m, pulgadas).
- **`groq`**: modelo alojado. Se activa configurando `PARAMETRICAD_GROQ_API_KEY`.

Sea cual sea el backend, la salida se valida contra el mismo esquema, de modo que
una pieza imposible se rechaza por las reglas del dominio y no por el kernel.

## Ejecución local

### Backend

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

Docker (recomendado; OpenCASCADE arrastra dependencias nativas de C++):

```bash
cd backend && docker build -t parametricad-backend . && docker run -p 8000:8000 parametricad-backend
```

### Frontend

```bash
cd frontend && npm install && npm run dev
```

Apunta el frontend al backend con `VITE_API_URL` (por defecto
`http://localhost:8000`).

## Configuración

Todo se controla por entorno con el prefijo `PARAMETRICAD_`; los grupos anidados
usan doble guion bajo.

| Variable                                        | Por defecto | Descripción                                     |
| ----------------------------------------------- | ----------- | ----------------------------------------------- |
| `PARAMETRICAD_EXTRACTOR`                        | `auto`      | `auto` \| `rule_based` \| `groq`                |
| `PARAMETRICAD_GROQ_API_KEY`                     | —           | Activa el backend LLM cuando `auto`             |
| `PARAMETRICAD_TESSELLATION__LINEAR_DEFLECTION_MM` | `0.05`    | Fidelidad del teselado                          |
| `PARAMETRICAD_KERNEL_MAX_CONCURRENCY`           | `1`        | Trabajos CAD simultáneos                        |
| `PARAMETRICAD_REJECT_INVALID_MESHES`            | `true`     | Bloquea la publicación de mallas defectuosas    |
| `PARAMETRICAD_MAX_STORED_ARTIFACTS`             | `512`      | Retención en disco                              |
| `PARAMETRICAD_CORS_ALLOW_ORIGINS`               | ver config  | Lista separada por comas o JSON                 |

OpenCASCADE no es reentrante de forma fiable, por lo que la concurrencia del
kernel es 1 por defecto: se escala por procesos, no por hilos.

## Calidad

```bash
cd backend
pytest                       # 261 pruebas
ruff check app tests
mypy app                     # modo estricto
```

```bash
cd frontend
npm run typecheck            # TypeScript estricto
npm run lint
npm run build
```

Las pruebas de geometría se contrastan contra fórmulas cerradas (área de corona,
teorema de Pappus, volumen de caja menos cilindro), no contra valores grabados,
de modo que un cambio en las recetas de construcción falla en lugar de
convertirse en la nueva referencia.

## Requisitos

- Python 3.12+
- Node.js 20+
- Docker (recomendado para el backend)
