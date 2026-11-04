## ADDED Requirements

### Requirement: SnapTone conversion reuses its converter and keeps the bytes

The session's SnapTone conversion SHALL produce, for a given `.nam`, the same SnapTone file bytes as the single-thread TypeScript conversion in V8. Splitting the render across workers and running the clone hot loops in wasm MUST NOT change any output byte. When the fast path cannot load, the conversion MUST fall back to the TypeScript path and MUST still succeed.

Within one app session, the converter SHALL load the test signal and the wasm kernels once and SHALL keep the resampled excitation for each model sample rate it has converted. A later conversion at a rate already converted MUST NOT fetch the test signal again and MUST NOT resample it again. A conversion MUST start only when the user asks for it, from a `.nam` the user loaded or a TONE3000 model the user picked. The converter MUST NOT keep SnapTone files across app sessions.

Cancel during conversion MUST stop every worker of that conversion and MUST NOT send. Progress MUST keep the stages excitation, render, and clone and MUST NOT go backwards. Conversion MUST NOT open a MIDI link.

#### Scenario: Fast path gives the same bytes

- **WHEN** the fixture `.nam` is converted with one render worker and the TypeScript clone, and again with four render workers and the wasm clone
- **THEN** both SnapTone files are byte-identical

#### Scenario: Second conversion reuses the signal

- **WHEN** a 48 kHz `.nam` has been converted and the user converts another 48 kHz `.nam` in the same session
- **THEN** the test signal is not fetched again
- **AND** the excitation is not resampled again

#### Scenario: Cancel stops all render workers

- **WHEN** the user cancels while four render workers are running
- **THEN** every worker of that conversion stops
- **AND** no SnapTone file is sent

#### Scenario: Kernel load failure falls back

- **WHEN** the clone kernel cannot be loaded
- **THEN** the conversion uses the TypeScript clone
- **AND** returns the same bytes

#### Scenario: Nothing is converted ahead of time

- **WHEN** the TONE3000 catalog lists the user's favorites
- **THEN** no model is downloaded or converted until the user picks one
