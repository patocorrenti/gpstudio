# Feature: subir capturas NAM al pedal como SnapTone (GP Studio)

Plan de trabajo para el change. Todavía no está en scope: `docs/architecture.md` sigue listando IR / NAM file upload como posterior. Este archivo es el acuerdo para proponer e implementar ese change.

## Decisiones

Acordadas antes de la Fase 0.

1. **UI integrada.** Con el multi-effects conectado, una acción junto a las del patch (Save / Options) abre un modal. No hay ruta nueva ni ítem de menú. El lugar exacto del botón se ajusta al implementar.
2. **El módulo aislado solo convierte.** `inspectNam` y `convertNamToSnapTone` viven en `src/snaptone/`. La UI vive en `src/features/` (modal del controller). El catálogo y el upload SysEx van por `DeviceSession` y los codecs que ya existen. No se porta el MIDI de VLTN. Si el formato de subida solo se puede conocer copiando ese uploader, se anota en `RESEARCH.md` y se pregunta antes de portarlo. Cuanto menos código GPL haya, mejor.
3. **La lista de slots es del equipo.** La sesión ya la pide una vez al conectar y la guarda en memoria hasta desconectar. El modal muestra esa copia. Si al abrirlo todavía no llegó, espera esa misma respuesta. Después de subir, se vuelve a pedir y se reemplaza la copia. No se persiste en disco.
4. **Pisar un slot no reescribe patches.** El patch sigue apuntando al mismo número y pasa a sonar con el SnapTone nuevo. El diálogo muestra número y nombre del slot. No se recorren los patches para listar cuáles lo usan.
5. **El dump de nombres ya existe.** `src/device/nam-names.ts`: 80 nombres, fábrica en los índices 0–55, usuario en 56–79 (24 slots). Un nombre vacío usa el fallback `SnapTone 01`…`SnapTone 24`. No hay un bit de “vacío”. La Fase 0 reconcilia esto con los 30 slots de usuario que menciona VLTN. No se reimplementa ese dump.

## Objetivo

Agregar a GP Studio un modal equivalente a **Manage → N->S** de Valeton Suite:

1. Se ven los slots SnapTone del equipo (nombre, ocupado/vacío, de fábrica/de usuario).
2. El usuario elige un slot, carga un archivo `.nam` y la app lo convierte a SnapTone.
3. La app sube el resultado al pedal por USB y lo confirma leyendo el catálogo de nuevo.

Formato de entrada: **NAM A2**. Es el formato prioritario y el único obligatorio. TONE3000 y la mayoría de las capturas nuevas ya vienen en A2.

- **A1 queda fuera de esta tarea.** Se evalúa después, en una fase aparte, y es opcional. Mientras tanto, si llega un archivo A1, se rechaza con un mensaje claro: "A1 captures aren't supported yet".
- **El camino es A2 → SnapTone, sin pasar por A1.** No se implementa nada que convierta o destile A2 a A1 (como `nam-a2a1-converter`). Esos conversores son workarounds para equipos que solo aceptaban A1 y no tienen lugar acá.
- **Regla general:** se replica lo que hace el código de referencia para A2, y nada más. Si en la referencia aparece algo que existe solo por compatibilidad o por razones legacy, no se porta. Si no queda claro si algo es legacy, se anota en `RESEARCH.md` y se pregunta.

Equipos objetivo: **GP-5 y GP-50**.

## Contexto de GP Studio

- Controlador no oficial, open source y orientado a desktop para los Valeton GP-5 y GP-50.
- App web/PWA: https://gpstudio.patocorrenti.com/. Va a tener también un paquete para Microsoft Store.
- Se conecta por WebMIDI (USB) y Web Bluetooth. Funciona en Chrome/Edge sobre Windows, Mac y Linux, y en Android Chrome solo por BT.
- Es "Windows first".
- En los textos de UI, los equipos se llaman **"multi-effects"**, no "pedals".
- Antes de escribir código, leé la estructura del repo de GP Studio y seguí sus convenciones: framework, manejo de estado, capa MIDI y estilos. No metas un stack nuevo.
- `DeviceSession` es la única fachada pública. La UI importa `@/device/session`. Los codecs quedan en `src/device/`. La UI de la feature queda en `src/features/`.

## Implementación de referencia

### Principal: VLTN Tone Studio

- Repo: https://github.com/grzmol/VLTN-Tone-Studio, licencia **GPL-3.0**.
- Stack: Electron + React + TypeScript + Tailwind. Usa WebMIDI con SysEx.
- Lo que hace y nos interesa:
  - Convierte capturas NAM A1 y A2 a SnapTone de la misma forma que Valeton Suite, dentro de un Web Worker.
  - Sube el resultado por USB a un slot de usuario.
  - Sube IRs de gabinete a los 20 slots User IR.
- La conversión A2 llegó en el PR #1 (https://github.com/grzmol/VLTN-Tone-Studio/pull/1). Según el commit, ejecuta la última submodelo de un `SlimmableContainer` con un kernel wasm que sigue el camino rápido A2 de NeuralAmpModelerCore, y después corre el mismo pipeline de "clone" que se usa para A1.
- Su README dice que la GP-5 y la GP-50 tienen 30 slots SnapTone de usuario. **Verificalo contra el hardware o el código.** GP Studio ya decodifica 24 slots de usuario (índices de dump 56–79) dentro de una tabla de 80 nombres. Valeton anuncia 80 slots en total, con 50 precargados.
- Tiene un modo mock (`?mock`) con una GP-5 simulada. Sirve para entender el flujo sin pedal.

### Secundaria: drewmerc302/valeton-gp50

- Repo: https://github.com/drewmerc302/valeton-gp50, licencia MIT.
- Editor WebMIDI para GP-5 y GP-50 con el protocolo SysEx obtenido por ingeniería inversa.
- Sirve como referencia para **leer el catálogo de SnapTones e IRs** del equipo. **No** convierte ni sube NAM.
- Tiene notas de protocolo en `docs/` y `re/`.
- GP Studio ya tiene el dump de nombres SnapTone. Esta referencia se usa si la Fase 0 necesita un mensaje que el dump actual no cubre (por ejemplo, ocupado/vacío).

## Licencia: pendiente de decisión, NO resolver en esta tarea

GP Studio (MIT) todavía no decidió cómo manejar la GPL-3 de VLTN. Hasta que eso se resuelva:

- **Todo el código portado o adaptado de VLTN va aislado en `src/snaptone/`.** Debe tener:
  - Header en cada archivo con atribución: `Portions adapted from VLTN Tone Studio (https://github.com/grzmol/VLTN-Tone-Studio), GPL-3.0`.
  - Un `README.md` del módulo que liste qué archivo viene de dónde, con el commit de origen.
- El resto de GP Studio habla con ese módulo **solo a través de la interfaz de conversión**. La UI y la sesión no comparten código con el módulo. La idea es poder reemplazar la conversión más adelante sin tocar la UI ni el SysEx.
- Trabajá en una **rama aparte**. No hagas merge a main ni deploy a producción.
- No copies código de Valeton Suite ni de sus binarios. Tampoco incluyas datos propietarios en el repo, por ejemplo JSONs extraídos de una instalación del Suite.
- El SysEx de catálogo y de upload se escribe como el resto del protocolo de GP Studio (capturas, no un port de VLTN). Si eso no alcanza, se para y se pregunta.

## Fase 0: investigación (hacela antes de implementar)

Cloná VLTN Tone Studio y escribí `src/snaptone/RESEARCH.md` con lo siguiente. Indicá rutas y líneas del repo de referencia en cada punto.

1. **Lectura del catálogo de slots**: qué mensaje SysEx pide la lista de SnapTones, cómo se decodifica la respuesta y qué slots son de usuario y cuáles de fábrica. Partí del dump que ya implementa `src/device/nam-names.ts`. Anotá si hace falta otro mensaje para saber si un slot está vacío.
2. **Parseo del `.nam`**: cómo reconoce un A2 (`architecture`, `version`, `config`, `SlimmableContainer`) y cómo elige la submodelo que se ejecuta. Según el PR #1, usa la última. Documentá también cómo detectar un A1, aunque sea solo para rechazarlo.
3. **Pipeline de conversión** A2 → SnapTone, paso a paso:
   - Qué es el "clone pipeline": ¿re-muestreo, render de una señal de prueba, ajuste o entrenamiento de un modelo propio, cuantización?
   - Qué entra y qué sale (bytes, tamaño, formato del blob final).
   - Cuánto tarda y cuánta CPU usa.
4. **Kernel A2 en wasm**: de dónde sale, cómo se compila y qué toolchain necesita. ¿Viene precompilado en el repo?
5. **Protocolo de upload**: secuencia de mensajes, chunking, ACKs, checksums y CRC, cómo se pone el nombre del slot y qué hace el pedal al terminar. Describilo para reimplementarlo en la sesión. No copies el uploader de VLTN salvo que, después de preguntar, sea la única fuente.
6. **Manejo de errores** del pedal: NACK, timeouts, desconexión.
7. **Transporte**: ¿el upload funciona solo por USB o también por BT? GP Studio soporta los dos; si por BT no se puede, la feature queda deshabilitada en BT con un mensaje claro.
8. Diferencias entre **GP-5 y GP-50** en todo lo anterior.

Al terminar la Fase 0, **parate y mostrá el resumen** antes de seguir. Si algo no queda claro, escribí la duda en el documento y no adivines.

## Interfaz del módulo

El módulo no recibe una conexión MIDI.

```ts
type NamKind = 'A1' | 'A2' | 'unsupported';

interface NamInspection {
  kind: NamKind;
  version?: string;
  sampleRate?: number;
  name?: string;          // del metadata del .nam, si existe
  reason?: string;        // si es unsupported, por qué (para mostrar al usuario)
}

inspectNam(file: ArrayBuffer): Promise<NamInspection>;
convertNamToSnapTone(
  file: ArrayBuffer,
  opts: { name: string; device: 'GP-5' | 'GP-50' },
  onProgress?: (p: number, stage: string) => void,
  signal?: AbortSignal,
): Promise<Uint8Array>;
```

- La conversión corre en un **Web Worker**; no debe bloquear la UI.
- `device` queda en la firma hasta que la Fase 0 diga si el blob cambia entre GP-5 y GP-50. Si es el mismo, se saca.
- Leer slots y subir el `Uint8Array` es trabajo de `DeviceSession`, con el mismo estilo que el dump de nombres y los SET que ya existen. Durante la subida se bloquean las demás escrituras de la app al equipo.

```text
modal (src/features/, junto al patch)
        |
        |  archivo .nam
        v
src/snaptone/     inspect + convert  -->  bytes
        |
        v
DeviceSession     manda esos bytes al slot elegido
```

## Requisitos funcionales (UI)

- Modal de **SnapTones**, abierto desde la barra del patch con el equipo conectado. Grilla o lista de slots: número, nombre y estado. Los slots de fábrica se ven pero no se pueden sobrescribir, salvo que la Fase 0 muestre que el Suite sí lo permite.
- En un slot de usuario, se carga el archivo con botón o drag & drop de `.nam`.
- Al cargar el archivo:
  1. `inspectNam` muestra tipo, versión y nombre. Si no está soportado (A1, archivo inválido o una geometría A2 desconocida), se explica por qué en una línea clara.
  2. Campo de nombre del slot, con el largo máximo que acepte el pedal.
  3. Si el slot está ocupado, se pide confirmación de sobrescritura. El texto muestra el número y el nombre actual. No lista patches. Los patches que ya apuntan a ese número siguen apuntando ahí y pasan a sonar con el SnapTone nuevo.
  4. Progreso en dos etapas, "Convirtiendo…" y "Enviando al multi-effects…", con opción de cancelar.
  5. Al terminar, se vuelve a leer el catálogo y se confirma que el slot tiene el nombre nuevo.
- Mientras se sube, se bloquean las demás escrituras de la app al equipo, como cambios de preset o ediciones en vivo.
- Si se desconecta en medio del upload, se muestra un mensaje claro y el estado del slot queda como desconocido hasta volver a leer el catálogo.
- Si el puerto MIDI está ocupado, sugerir cerrar Valeton Suite.
- Textos de UI en inglés, siguiendo el tono que ya tiene la app.

**Fuera de alcance** en esta tarea, salvo que salga casi gratis: subir IRs de gabinete, borrar slots (el comando y el tamaño del cuerpo están en `src/snaptone/RESEARCH.md`, sección 9; no está implementado), buscar en TONE3000, preview de audio del NAM, barrer patches para ver cuáles usan un slot.

## Fases

1. **Fase 0**: investigación y `RESEARCH.md`, centrada en A2. Parar y mostrar resultados.
2. **Fase 1: A2 de punta a punta.** Es obligatoria y se hace en este orden:
   1. Mostrar en el modal el catálogo que la sesión ya tiene. Es solo lectura y sin riesgo; conviene tenerlo funcionando antes de escribir nada.
   2. Kernel de inferencia A2 en el Worker, más el pipeline de clone, dentro de `src/snaptone/`.
   3. Upload al slot por la sesión, y verificación leyendo el catálogo de nuevo.
3. **Fase 2 (opcional, más adelante):** soporte A1. No arrancarla sin pedido explícito.

Cada fase termina con algo funcionando y testeado. No arranques la siguiente sin cerrar la anterior.

## Tests

- **Unitarios**: parseo de `.nam` con fixtures A2 (Full y Lite, si hay), un A1 que tiene que rechazarse y un archivo inválido. También decodificación del catálogo con respuestas SysEx reales capturadas. No commitear capturas de terceros salvo que la licencia del archivo lo permita; preferir un A2 sintético mínimo, o un fixture que ya esté en VLTN y su licencia permita copiarlo.
- **Golden test de conversión A2**: para un `.nam` A2 dado, el blob que generamos tiene que ser idéntico byte a byte al que genera VLTN, y si es posible al que manda Valeton Suite (capturado con un monitor MIDI). Si no da idéntico, documentá la diferencia.
- **Protocolo**: tests contra un dispositivo mock que valide secuencia, chunking y checksums.
- **Checklist manual en hardware** (lo corre Pato; dejalo escrito en `src/snaptone/HARDWARE_TEST.md`):
  - Hacer backup antes, desde el Suite o desde la app.
  - Subir a un slot vacío y verificar que suena y que el nombre es el correcto.
  - Sobrescribir un slot de usuario.
  - Cancelar a mitad del upload y comprobar que el pedal sigue funcionando.
  - Desconectar el USB a mitad del upload.
  - Repetir todo en GP-5 y GP-50.

## Entregables

- Módulo `src/snaptone/` aislado, con `README.md` de atribución, `RESEARCH.md` y `HARDWARE_TEST.md`.
- Modal de slots SnapTone en la pantalla del pedal conectado.
- Upload SysEx en la sesión existente.
- Tests de lo anterior.
- Una rama con commits chicos por fase y un resumen final: qué funciona, qué no y qué queda abierto.
