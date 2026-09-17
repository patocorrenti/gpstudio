# Patone: web + Windows (Tauri) + OpenSpec

Plan acordado para Patone, editor/controlador de pedales Valeton GP-5 y GP-50.

El producto habla USB-MIDI y Bluetooth con GP-5 y GP-50: recall de patch usa el MIDI CC oficial; un subset SysEx de identidad (patch actual + nombres) y de la cadena de audio del patch actual (orden + on/off) se pide al conectar. Editor SysEx completo (parámetros, IRs, NAM) y librería vienen después.

## Stack

- **UI:** Vite + React + TypeScript + Tailwind + shadcn (desde el scaffold)
- **Tema:** dark por default, light opcional (tokens / clase `dark` de shadcn). No es un change aparte: entra en `bootstrap-app`.
- **Shell nativo:** Tauri 2 (instalador Windows ahora; iOS/Android más adelante)
- **MIDI / link:** USB y Bluetooth son links distintos. USB-MIDI usa `MidiTransport` (tubo de bytes + discovery), no tipos `MIDIPort`
  - Fase 1, USB-MIDI: dos backends del mismo contrato USB
    - Browser: Web MIDI (`navigator.requestMIDIAccess`)
    - Desktop/mobile: Rust `midir` vía comandos/eventos Tauri (WebView2 **no** expone Web MIDI)
  - Un endpoint USB lleva `id`, `label`, `kind: usb-midi` y `suggestedModel` opcional
  - Bluetooth (servicio BLE-MIDI MMA) es otro backend, no un `kind` más del tubo MIDI:
    - Browser: Web Bluetooth
    - Desktop: Rust `btleplug` vía comandos Tauri (WebView2 **no** expone Web Bluetooth)
    - Contrato `BluetoothLink`: `discover` / `open` / `send` / `subscribe` / `close`
    - Un endpoint Bluetooth lleva `id`, `label`, `kind: bluetooth` y `suggestedModel` opcional
- **Estado de dispositivo:** capa TypeScript compartida, independiente del transporte
- **Sin backend HTTP.** La app habla directo con el pedal

Electron queda descartado: más pesado y peor camino a mobile. El costo de Tauri es el doble backend USB-MIDI, que se aísla detrás de la interfaz.

## Arquitectura

```mermaid
flowchart TB
  subgraph ui [React UI]
    Shell[AppShell]
    ConnectStatus[ConnectionStatus]
    Controller[LiveController]
    Editor[PresetEditor later]
    Library[PresetLibrary later]
  end

  subgraph domain [Device layer]
    Session[DeviceSession]
    Profiles[GP5 and GP50 profiles]
    CcMap[Official MIDI CC maps]
    Sysex[Identity and chain SysEx plus editor later]
  end

  subgraph transport [MidiTransport]
    WebMidi[WebMidiTransport]
    TauriMidi[TauriMidiTransport]
  end

  subgraph bluetooth [BluetoothLink]
    WebBle[WebBluetoothLink]
    TauriBle[TauriBluetoothLink]
  end

  subgraph native [Tauri Rust]
    Midir[midir WinMM]
    Btle[btleplug]
  end

  Shell --> ConnectStatus
  Shell --> Controller
  Shell --> Editor
  Shell --> Library
  ConnectStatus --> Session
  Controller --> Session
  Editor --> Session
  Library --> Session
  Session --> Profiles
  Session --> CcMap
  Session --> Sysex
  Session --> transport
  Session --> bluetooth
  WebMidi --> Pedal[USB MIDI pedal]
  TauriMidi --> Midir
  Midir --> Pedal
  WebBle --> BlePedal[GATT pedal]
  TauriBle --> Btle
  Btle --> BlePedal
```



La UI nunca llama MIDI crudo. `DeviceSession` conoce el modelo (GP-5 vs GP-50), traduce acciones a CC/SysEx, y el transporte solo envía/recibe bytes. Tres ejes, no mezclarlos:

- **Modelo:** GP-5 vs GP-50 (perfiles / CCs / UI)
- **Protocolo:** CC oficial para recall; SysEx de identidad (índice + nombres) y de la cadena actual (orden + on/off) al conectar y al cambiar de patch; editor SysEx de parámetros después
- **Link:** USB vs Bluetooth (cómo llega el paquete). No son intercambiables.

USB es one-way y super fast para knobs y módulos: la app manda CC; el pedal no telemetra esos controles. Sí puede responder dumps SysEx pedidos (y al cargar un patch). Eso no convierte USB en duplex de live controls.

Bluetooth es two-way y más lento. El pedal anuncia el servicio BLE-MIDI MMA y Patone escribe recall de patch (CC 0 envuelto en paquete BLE-MIDI) y las peticiones de identidad y de cadena en esa característica I/O. Sigue siendo otro backend (`BluetoothLink`, no el tubo USB-MIDI), no un fork de `DeviceSession`. Controller, Editor y Library siguen en una sola sesión; `linkMode` (`usb` | `bluetooth`) es una máscara de capacidades (`liveFromPedal`, `commandToPedal`). Connect escanea y abre GATT. El encoder corre en `DeviceSession` y `BluetoothLink.send` escribe esos bytes; **no copiar** SysEx reverse-engineered de terceros. Referencias de comportamiento: `docs/protocol-references.md`. El Log muestra MIDI inbound de USB y Bluetooth (framing BLE-MIDI unwrappeado) solo mientras esa pantalla está abierta y no aplica tráfico. `DeviceSession` sí aplica identidad de patch (índice y nombres) y la cadena actual (orden + on/off) al snapshot. Volumen y el live-from-pedal de knobs/módulos (CC mientras el patch no cambia) siguen después.

`MidiTransport` no es “listar puertos Web MIDI”. Es discovery + tubo USB-MIDI:

- `discover()` → endpoints (`id`, `label`, `kind: usb-midi`, `suggestedModel?`)
- `open(id)` / `send(bytes)` / `onMessage(bytes)` / `close()`, plus a disconnect signal if the USB port drops

`BluetoothLink` es discovery + sesión GATT + tubo de bytes:

- `discover()` → endpoints (`id`, `label`, `kind: bluetooth`, `suggestedModel?`)
- `open(id)` / `send(bytes)` / `subscribe(handler)` / `close()`, plus a disconnect signal if GATT drops

Web MIDI y `midir` son los dos backends USB. Web Bluetooth y `btleplug` son los dos backends GATT. Connect abre con tabs USB | Bluetooth: el usuario elige el método primero. La pestaña USB usa el tubo MIDI; la pestaña Bluetooth escanea pedales y conecta GATT. Phase 1 MIDI endpoints siguen `kind: usb-midi`.

Patch recall por Bluetooth ya es CC 0 envuelto en paquete BLE-MIDI. Si un comando futuro no habla CC, el gancho sigue siendo el encoder (CC vs SysEx), el mismo que necesita el editor USB.

Connect no es una pantalla: es estado de sesión global. El chrome lo muestra siempre (sin pedal: Connect) y el flujo de conexión ocurre en un modal. Controller es la home.

## Estructura de repo

Un solo app (no monorepo). OpenSpec vive en la raíz, al lado del código.

```text
patone/
  openspec/
    config.yaml
    specs/
    changes/
  .cursor/               # skills y commands OPSX (openspec init --tools cursor)
  src/
    app/                 # shell React: layout, routing, theme (dark default)
    features/
      connect/           # estado global + modal (no es una página)
      controller/        # home / fase 1
      editor/            # fase 2 (stub)
      library/           # fase 3 (stub)
    device/
      models.ts          # Gp5 | Gp50
      profiles/
      cc.ts              # maps oficiales
      session.ts
    midi/
      types.ts           # MidiTransport: endpoints + bytes (kind usb-midi)
      detect.ts          # elige backend USB web vs tauri
      web.ts
      tauri.ts
    bluetooth/
      types.ts           # BluetoothLink: endpoints + GATT open/send/subscribe/close (kind bluetooth)
      detect.ts          # elige backend BLE web vs tauri
      web.ts
      tauri.ts
  src-tauri/             # Tauri 2 + midir + btleplug
  package.json
```

Perfiles de dispositivo (fase 1, CC oficial):

- **GP-5:** CC 0 patch, 7 volume, 22–25 bank/patch, 48–57 módulos, 58 tuner, 69 CTL
- **GP-50:** lo anterior + master/EXP/BPM/modo Patch|Stomp (CC 1, 11, 13, 17, 19, 21, 28)

Detección: el endpoint sugiere modelo por el nombre USB o el advertised name Bluetooth (Valeton suele aparecer como GP-5 / GP-50). Si hay duda o el nombre no encaja, el usuario confirma o corrige. No tratar el nombre como identidad de hardware.

## OpenSpec

Las specs en `openspec/specs/` son el contrato de comportamiento que perdura. Un change no es obligatorio en cada tarea.

**Carril Change** — nueva capability, comportamiento nuevo o controvertido, arquitectura, o algo que conviene acordar antes de codear. `/opsx-propose` → review → `/opsx-apply` → `/opsx-archive`. Se puede omitir `design.md` si no hay cruce de módulos ni ambigüedad. `skip_specs: true` solo si no cambia comportamiento (refactor, tooling, docs).

**Carril Directo** — bugfix, copy, polish de UI, refactor interno, o corrección de Purpose/typos en specs. Codear y, en el mismo trabajo, actualizar lo que debe sobrevivir: `openspec/specs/<capability>/spec.md` si cambió comportamiento observable; este archivo si cambió el plan acordado; el `context:` de `openspec/config.yaml` si cambió una restricción del agente. No crear change, no escribir deltas `ADDED`/`MODIFIED`/`REMOVED` (eso es formato de change, no de spec base), no archivar. Si se tocó una spec, validar con `openspec validate --specs`.

Criterio: si un usuario o sistema podría notar una diferencia y esa diferencia no está en la spec, hay que tocarla. Si no hay diferencia observable, no inventar un requirement ni un change. Si hay duda de carril, preguntar. No usar Change por inercia.

El agente no prueba en el navegador a menos que el usuario lo pida explícitamente. Typecheck/lint sí; la UI la prueba el usuario.

Cambios previstos, en orden:

1. `bootstrap-app` — scaffold Tauri 2 + Vite/React/TS/Tailwind/shadcn, tema dark default, scripts `dev` / `tauri dev` / `build`
2. `midi-transport` — `MidiTransport` (endpoints + bytes, `kind: usb-midi`) + Web MIDI + comandos Rust `midi_list_ports` / `open` / `send` + eventos inbound. Sin BLE.
3. `device-connection` — detectar GP-5/GP-50, conectar, estado de sesión (control global + modal, no una ruta)
4. `live-controller` — patch, volumen, on/off de módulos, tuner (CC oficial)
5. Más adelante: `preset-editor` (SysEx), `preset-library`, IRs/NAM

Dominios de spec: `midi-transport`, `device-connection`, `live-controller`, `bluetooth-link`, `inbound-log`. El editor y la librería no se especifican hasta su change.

El SysEx de editor/IRs está reverse-engineered en proyectos ajenos. **No copiar ese código.** El codec de identidad (patch actual + nombres) y el de cadena (orden + on/off del patch actual) son de Patone. Parámetros completos, IRs y NAM se documentan en el design del editor. Editores de referencia: `docs/protocol-references.md`.

## Fase 1 — lo que se ve

Chrome siempre visible: nombre Patone, control de conexión a la izquierda, secciones Controller / Editor / Library y tema a la derecha. Controller es la home (`/`). Connect no es una sección: es estado global. Sin pedal el control dice Connect y abre un modal.

Modal de conexión: tabs USB y Bluetooth. USB pide permiso MIDI, lista endpoints, conecta, sugiere/confirma modelo, y se presenta como one-way y super fast. Bluetooth explica two-way y más lento, escanea pedales GATT, conecta, y sugiere/confirma modelo. Con Bluetooth conectado, Controller manda recall de patch por el encoder GATT (mismo selector 00–99 que USB). Qué muestra el control cuando hay pedal se define en `device-connection`.

Pantalla Controller: al conectar puede mostrar loading mientras sincroniza identidad y la cadena de audio; luego selector de patch 00–99 (con nombres si llegaron) y la cadena del patch actual (10 slots en GP-5, 11 en GP-50 con EXP al final, on/off visible, sin editar). Volumen, toggles editables, tuner y extras GP-50 vienen después.

Pantalla Log: MIDI inbound de USB o Bluetooth solo mientras está abierta. No aplica ese tráfico al snapshot. La sesión puede aplicar identidad de patch y dumps de cadena por separado.

Empaquetado Windows: `tauri build` → instalador NSIS/MSI. Web: `vite` en Chrome/Edge (localhost o HTTPS). Mobile queda fuera de estos cambios; la abstracción MIDI ya lo deja preparado.

## Fuera de alcance ahora

- App mobile Tauri
- Lectura/escritura de parámetros de preset, rename, reorder (la cadena actual — orden + on/off — sí se lee)
- Upload de IR / SnapTone / NAM
- Aplicar inbound de volumen, módulos u otros CCs al snapshot (`liveFromPedal` de knobs) mientras el patch no cambia
- Encender/apagar o reordenar módulos desde la UI
- Volumen, tuner y extras GP-50 por Bluetooth



## Roadmap

- [x] Init git + OpenSpec (Cursor) y completar `openspec/config.yaml` con el contexto del stack
- [x] Change OpenSpec `bootstrap-app`: Tauri 2 + Vite + React + TS + Tailwind + shadcn, dark default
- [x] Change `midi-transport`: interfaz `MidiTransport` (endpoints + bytes), Web MIDI y backend Tauri/midir (USB only)
- [x] Change `device-connection`: perfiles GP-5/GP-50, detección y sesión (control global + modal)
- [x] Change `link-modes`: tabs USB | Bluetooth, `linkMode` en la sesión
- [x] Change `bluetooth-connect`: scan/conectar GATT (sin encoder de patch)
- [x] Change `live-controller`: UI de patch 00–99 via MIDI CC oficial (USB)
- [x] Change `bluetooth-patch-control`: encoder de patch sobre GATT (mismo Controller que USB)
- [x] Change `inbound-log`: Log inbound USB + Bluetooth solo con la página Log abierta
- [x] Change `patch-sync`: identidad inicial (patch actual + nombres) USB y Bluetooth
- [ ] Change `audio-chain`: dump de cadena del patch actual (orden + on/off) y dibujo en Controller