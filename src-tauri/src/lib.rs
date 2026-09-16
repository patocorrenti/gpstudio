mod ble;
mod midi;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(midi::MidiState::default())
    .manage(ble::BleState::default())
    .invoke_handler(tauri::generate_handler![
      midi::midi_list_ports,
      midi::midi_open,
      midi::midi_send,
      midi::midi_close,
      ble::ble_scan,
      ble::ble_open,
      ble::ble_close,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
