use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::{Adapter, Manager, Peripheral};
use serde::Serialize;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::sleep;

#[derive(Default)]
pub struct BleState {
    connected: Mutex<Option<Peripheral>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BleEndpointDto {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub suggested_model: Option<String>,
}

fn compact_name(label: &str) -> String {
    label
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-' && *c != '_')
        .collect::<String>()
        .to_lowercase()
}

fn suggest_model(label: &str) -> Option<&'static str> {
    let compact = compact_name(label);
    if compact.contains("gp50") {
        return Some("gp50");
    }
    if compact.contains("gp5") {
        return Some("gp5");
    }
    None
}

fn looks_like_pedal(label: &str) -> bool {
    suggest_model(label).is_some() || compact_name(label).contains("valeton")
}

async fn first_adapter() -> Result<Adapter, String> {
    let manager = Manager::new()
        .await
        .map_err(|_| "Bluetooth is unavailable.".to_string())?;
    let adapters = manager
        .adapters()
        .await
        .map_err(|_| "Bluetooth is unavailable.".to_string())?;
    adapters
        .into_iter()
        .next()
        .ok_or_else(|| "Bluetooth is unavailable.".to_string())
}

fn endpoint_id(peripheral: &Peripheral) -> String {
    peripheral.address().to_string()
}

async fn matching_endpoints(adapter: &Adapter) -> Result<Vec<BleEndpointDto>, String> {
    let mut endpoints = Vec::new();
    for peripheral in adapter
        .peripherals()
        .await
        .map_err(|err| err.to_string())?
    {
        let properties = peripheral
            .properties()
            .await
            .map_err(|err| err.to_string())?;
        let Some(label) = properties.and_then(|props| props.local_name) else {
            continue;
        };
        if !looks_like_pedal(&label) {
            continue;
        }
        endpoints.push(BleEndpointDto {
            id: endpoint_id(&peripheral),
            label,
            kind: "bluetooth".to_string(),
            suggested_model: suggest_model(&label).map(str::to_string),
        });
    }
    Ok(endpoints)
}

#[tauri::command]
pub async fn ble_scan() -> Result<Vec<BleEndpointDto>, String> {
    let adapter = first_adapter().await?;
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|_| "Bluetooth is unavailable.".to_string())?;
    sleep(Duration::from_secs(4)).await;
    let endpoints = matching_endpoints(&adapter).await;
    let _ = adapter.stop_scan().await;
    endpoints
}

async fn find_peripheral(adapter: &Adapter, id: &str) -> Result<Peripheral, String> {
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|err| err.to_string())?;
    sleep(Duration::from_secs(2)).await;
    let peripherals = adapter
        .peripherals()
        .await
        .map_err(|err| err.to_string())?;
    let _ = adapter.stop_scan().await;
    for peripheral in peripherals {
        if endpoint_id(&peripheral) == id {
            return Ok(peripheral);
        }
    }
    Err("The pedal is no longer available.".to_string())
}

#[tauri::command]
pub async fn ble_open(state: tauri::State<'_, BleState>, id: String) -> Result<(), String> {
    let mut connected = state.connected.lock().await;
    if let Some(previous) = connected.take() {
        let _ = previous.disconnect().await;
    }
    let adapter = first_adapter().await?;
    let peripheral = find_peripheral(&adapter, &id).await?;
    peripheral
        .connect()
        .await
        .map_err(|_| "Could not open the Bluetooth connection.".to_string())?;
    *connected = Some(peripheral);
    Ok(())
}

#[tauri::command]
pub async fn ble_close(state: tauri::State<'_, BleState>) -> Result<(), String> {
    let mut connected = state.connected.lock().await;
    if let Some(peripheral) = connected.take() {
        let _ = peripheral.disconnect().await;
    }
    Ok(())
}
