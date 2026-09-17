use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct MidiState {
    input: Mutex<Option<MidiInputConnection<()>>>,
    output: Mutex<Option<MidiOutputConnection>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MidiEndpointDto {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub suggested_model: Option<String>,
}

fn suggest_model(label: &str) -> Option<&'static str> {
    let compact: String = label
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-' && *c != '_')
        .collect::<String>()
        .to_lowercase();
    if compact.contains("gp50") {
        return Some("gp50");
    }
    if compact.contains("gp5") {
        return Some("gp5");
    }
    None
}

fn lock_poisoned<'a, T>(
    result: Result<std::sync::MutexGuard<'a, T>, std::sync::PoisonError<std::sync::MutexGuard<'a, T>>>,
) -> std::sync::MutexGuard<'a, T> {
    result.unwrap_or_else(|err| err.into_inner())
}

#[tauri::command]
pub fn midi_list_ports() -> Result<Vec<MidiEndpointDto>, String> {
    let midi_out = MidiOutput::new("patone-list").map_err(|err| err.to_string())?;
    let mut endpoints = Vec::new();
    for (index, port) in midi_out.ports().iter().enumerate() {
        let label = midi_out
            .port_name(port)
            .unwrap_or_else(|_| format!("USB device {index}"));
        endpoints.push(MidiEndpointDto {
            id: format!("{index}::{label}"),
            label: label.clone(),
            kind: "usb-midi".to_string(),
            suggested_model: suggest_model(&label).map(str::to_string),
        });
    }
    Ok(endpoints)
}

fn split_port_id(id: &str) -> Result<(usize, String), String> {
    let (index_str, label) = id
        .split_once("::")
        .ok_or_else(|| "Invalid USB device.".to_string())?;
    let index = index_str
        .parse::<usize>()
        .map_err(|_| "Invalid USB device.".to_string())?;
    Ok((index, label.to_string()))
}

fn find_output_port(
    midi_out: &MidiOutput,
    index: usize,
    label: &str,
) -> Result<midir::MidiOutputPort, String> {
    let ports = midi_out.ports();
    if let Some(port) = ports.get(index) {
        if midi_out.port_name(port).ok().as_deref() == Some(label) {
            return Ok(port.clone());
        }
    }
    ports
        .into_iter()
        .find(|port| midi_out.port_name(port).ok().as_deref() == Some(label))
        .ok_or_else(|| "The pedal is no longer available.".to_string())
}

fn find_input_port(midi_in: &MidiInput, label: &str) -> Option<midir::MidiInputPort> {
    midi_in
        .ports()
        .into_iter()
        .find(|port| midi_in.port_name(port).ok().as_deref() == Some(label))
}

fn drop_open_ports(state: &MidiState) {
    *lock_poisoned(state.input.lock()) = None;
    *lock_poisoned(state.output.lock()) = None;
}

#[tauri::command]
pub fn midi_open(app: AppHandle, state: State<MidiState>, id: String) -> Result<(), String> {
    drop_open_ports(&state);
    let (index, label) = split_port_id(&id)?;

    let midi_out = MidiOutput::new("patone-out").map_err(|err| err.to_string())?;
    let out_port = find_output_port(&midi_out, index, &label)?;
    let conn_out = midi_out
        .connect(&out_port, "patone-out")
        .map_err(|err| err.to_string())?;
    *lock_poisoned(state.output.lock()) = Some(conn_out);

    let mut midi_in = MidiInput::new("patone-in").map_err(|err| err.to_string())?;
    midi_in.ignore(Ignore::None);
    if let Some(in_port) = find_input_port(&midi_in, &label) {
        let handle = app.clone();
        let conn_in = midi_in
            .connect(
                &in_port,
                "patone-in",
                move |_stamp, message, _| {
                    let _ = handle.emit("midi-inbound", message.to_vec());
                },
                (),
            )
            .map_err(|err| err.to_string())?;
        *lock_poisoned(state.input.lock()) = Some(conn_in);
    }

    Ok(())
}

#[tauri::command]
pub fn midi_send(state: State<MidiState>, bytes: Vec<u8>) -> Result<(), String> {
    let mut output = lock_poisoned(state.output.lock());
    let conn = output
        .as_mut()
        .ok_or_else(|| "No pedal is connected.".to_string())?;
    conn.send(&bytes).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn midi_close(state: State<MidiState>) -> Result<(), String> {
    drop_open_ports(&state);
    Ok(())
}
