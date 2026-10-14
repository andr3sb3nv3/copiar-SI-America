# SI America

Recreación de [SI.gov](https://www.si.gov/), basada en el diseño y los recursos públicos consultados el 13 de octubre de 2026. Incluye la página principal, Educación y Presidential SI Challenge.

La ruta `/benve/` muestra “BENVE” y “vestidos de fiesta” a la izquierda, y el logo circular de partículas blancas girando a la derecha, sobre fondo azul. Al bajar, los mismos puntos se desplazan hacia la izquierda y forman BENVE en sans serif, con una reacción contenida al mouse y a las ondas para conservar la lectura. Más abajo se transforman en un vestido minimalista de un hombro, cintura entallada y tajo lateral. La cuarta figura lleva los puntos hacia la derecha y forma un segundo vestido de escote halter y caída sirena, en una posición más baja. Ambos usan blanco y lavanda para definir el drapeado y una superficie con profundidad. El color aparece gradualmente con los vestidos y vuelve a blanco al subir. Conserva la reacción elástica al mouse, ondas al clic y perspectiva 3D. En móvil, el texto inicial queda arriba del logo. Se accede desde el enlace BENVE del menú; el botón Recomponer devuelve los puntos a la figura correspondiente a la posición del scroll.

## Desarrollo

Requiere Node.js 22.12 o posterior; el entorno utiliza Node.js 24.19.0.

```bash
cd /workspace/copiar-SI-America
npm ci
npm run dev -- --port 5173 --strictPort
```

Cada tarea cloud ya tiene un entorno aislado. Trabaja en el checkout existente; no crees worktrees salvo que el usuario lo solicite.

## Compilar y comprobar

```bash
npm run build
npm test
npm run preview -- --port 4173 --strictPort
```

Las pruebas de Playwright usan Chromium en `/usr/bin/chromium` e inician el servidor de desarrollo cuando es necesario. Si tu navegador está en otra ubicación, establece `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con su ruta. `dist/` contiene las cuatro páginas para alojamiento estático.

## Abrir en Safari sin servidor

```bash
npm run export:safari
```

La exportación requiere Python 3 y genera `si-america-safari.zip` junto a la carpeta del proyecto. Descomprime el ZIP y abre `benve.html` con Safari para ver BENVE y sus transiciones de partículas, o `index.html` para SI.gov. Los cuatro archivos incluyen sus estilos, fuentes, imágenes y JavaScript; no hace falta instalar herramientas para verlos. Conserva los archivos HTML juntos para navegar entre ellos.

## Desplegar en Vercel

Importa el repositorio de GitHub y usa `main` como rama de producción. La carpeta raíz del proyecto es `./`; selecciona Node.js `24.x`. `vercel.json` configura Vite, `npm ci`, `npm run build` y la salida `dist`, y conserva las rutas con `/` al final.

BENVE está en `/benve/`. Las otras páginas son `/`, `/initiatives/education/` y `/initiatives/presidential-challenge/`. Cada ruta tiene su propio HTML compilado. Al subir cambios a `main`, Vercel genera un nuevo despliegue si la integración con GitHub está activa.

Las cuatro páginas incluyen botones fijos a la derecha para pasar entre SI.gov, BENVE, Educación y Challenge. El botón de la página actual aparece resaltado.

## Interacciones

- Las letras SI se transforman al pasar el mouse; en dispositivos táctiles, toca la figura.
- El cursor repele los puntos con retorno elástico. Un clic crea una onda radial.
- El scroll transforma la nube en esfera, número 13, hélice, edificios y bandera; también activa los textos, el contador y las etapas de las órdenes.
- El menú circular, los indicadores de sección, las tarjetas y la navegación entre páginas conservan el comportamiento del original.
- Las animaciones se pausan en segundo plano y respetan la preferencia de movimiento reducido. El canvas acepta Enter y Espacio para crear ondas mediante teclado.

## Archivos principales

- `src/site.js`: geometrías, proyección, físicas, cursor, transiciones y navegación, adaptados del JavaScript público del sitio de referencia.
- `src/benve.js` y `src/benve.css`: logo giratorio, palabra BENVE, vestido y transición de una sola nube al hacer scroll.
- `src/style.css`: estilos de la referencia y fuentes locales Instrument Serif e Instrument Sans.
- `index.html` e `initiatives/*/index.html`: contenido y estructura de las páginas.
- `public/images/`: logotipo y sello originales, almacenados localmente.
- `tests/particle.spec.js`: pruebas funcionales de partículas, navegación, móvil y movimiento reducido.
- `tests/benve.spec.js`: giro, tres figuras, scroll reversible, mouse, teclado, móvil y movimiento reducido de BENVE.

La página funciona con recursos locales. Los enlaces informativos externos apuntan a sus destinos originales. El video del Challenge utiliza el enlace y la vista alternativa del sitio original. El formulario conserva su diseño y valida el correo, pero no está conectado a un servicio de suscripción; indica que se visite SI.gov para suscribirse.
