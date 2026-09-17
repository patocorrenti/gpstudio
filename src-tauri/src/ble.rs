use btleplug::api::{
    Central, Characteristic, CharPropFlags, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use serde::Serialize;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::sleep;
use uuid::Uuid;

/// Keep in sync with src/bluetooth/uuids.ts (Patone Chrome GATT map, 2026-09-17).
const CONTROL_SERVICE_UUID: &str = "03b80e5a-ede8-4b33-a751-6ce34ec4c700";
const CONTROL_CHARACTERISTIC_UUID: &str = "7772e5db-3868-4112-a1a9-f2669d106bf3";

struct BleRuntime {
    _manager: Manager,
    adapter: Adapter,
}

struct BleSession {
    peripheral: Peripheral,
    characteristic: Characteristic,
}

#[derive(Default)]
pub struct BleState {
    runtime: Mutex<Option<BleRuntime>>,
    connected: Mutex<Option<BleSession>>,
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

fn control_uuids() -> Option<(Uuid, Uuid)> {
    Some((
        Uuid::parse_str(CONTROL_SERVICE_UUID).ok()?,
        Uuid::parse_str(CONTROL_CHARACTERISTIC_UUID).ok()?,
    ))
}

fn find_control_characteristic(peripheral: &Peripheral) -> Option<Characteristic> {
    let (service, characteristic) = control_uuids()?;
    peripheral.characteristics().into_iter().find(|entry| {
        entry.uuid == characteristic && entry.service_uuid == service
    })
}

fn connect_error(err: impl ToString) -> String {
    let raw = err.to_string();
    let lower = raw.to_lowercase();
    if lower.contains("auth") {
        return "Bluetooth pairing failed. Put the pedal in pairing mode, accept the pair request on this computer, then connect again.".to_string();
    }
    if lower.contains("not connected") || lower.contains("failed") {
        return format!("Could not open the Bluetooth connection. ({raw})");
    }
    "Could not open the Bluetooth connection.".to_string()
}

async fn wait_until_connected(peripheral: &Peripheral) {
    for _ in 0..30 {
        if peripheral.is_connected().await.unwrap_or(false) {
            return;
        }
        sleep(Duration::from_millis(100)).await;
    }
}

async fn discover_control(peripheral: &Peripheral) -> Option<Characteristic> {
    for _ in 1..=20 {
        let _ = peripheral.discover_services().await;
        if let Some(characteristic) = find_control_characteristic(peripheral) {
            return Some(characteristic);
        }
        sleep(Duration::from_millis(500)).await;
    }
    find_control_characteristic(peripheral)
}

async fn ensure_adapter(state: &tauri::State<'_, BleState>) -> Result<Adapter, String> {
    let mut runtime = state.runtime.lock().await;
    if let Some(existing) = runtime.as_ref() {
        return Ok(existing.adapter.clone());
    }
    let manager = Manager::new()
        .await
        .map_err(|_| "Bluetooth is unavailable.".to_string())?;
    let adapter = manager
        .adapters()
        .await
        .map_err(|_| "Bluetooth is unavailable.".to_string())?
        .into_iter()
        .next()
        .ok_or_else(|| "Bluetooth is unavailable.".to_string())?;
    let cloned = adapter.clone();
    *runtime = Some(BleRuntime {
        _manager: manager,
        adapter,
    });
    Ok(cloned)
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
        let suggested_model = suggest_model(&label).map(str::to_string);
        endpoints.push(BleEndpointDto {
            id: endpoint_id(&peripheral),
            label,
            kind: "bluetooth".to_string(),
            suggested_model,
        });
    }
    Ok(endpoints)
}

#[tauri::command]
pub async fn ble_scan(state: tauri::State<'_, BleState>) -> Result<Vec<BleEndpointDto>, String> {
    let adapter = ensure_adapter(&state).await?;
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|_| "Bluetooth is unavailable.".to_string())?;
    sleep(Duration::from_secs(4)).await;
    let endpoints = matching_endpoints(&adapter).await;
    let _ = adapter.stop_scan().await;
    endpoints
}

async fn lookup_peripheral(adapter: &Adapter, id: &str) -> Result<Option<Peripheral>, String> {
    let peripherals = adapter
        .peripherals()
        .await
        .map_err(|err| err.to_string())?;
    for peripheral in peripherals {
        if endpoint_id(&peripheral) == id {
            return Ok(Some(peripheral));
        }
    }
    Ok(None)
}

async fn find_peripheral(adapter: &Adapter, id: &str) -> Result<Peripheral, String> {
    if let Some(peripheral) = lookup_peripheral(adapter, id).await? {
        return Ok(peripheral);
    }
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|err| err.to_string())?;
    sleep(Duration::from_secs(2)).await;
    let found = lookup_peripheral(adapter, id).await;
    let _ = adapter.stop_scan().await;
    found?.ok_or_else(|| "The pedal is no longer available.".to_string())
}

#[tauri::command]
pub async fn ble_open(state: tauri::State<'_, BleState>, id: String) -> Result<(), String> {
    {
        let mut connected = state.connected.lock().await;
        if let Some(previous) = connected.take() {
            let _ = previous.peripheral.disconnect().await;
        }
    }
    let adapter = ensure_adapter(&state).await?;
    let peripheral = find_peripheral(&adapter, &id).await?;
    if peripheral.is_connected().await.unwrap_or(false) {
        let _ = peripheral.disconnect().await;
        sleep(Duration::from_secs(1)).await;
    }
    let _ = adapter.start_scan(ScanFilter::default()).await;
    sleep(Duration::from_millis(400)).await;
    peripheral.connect().await.map_err(connect_error)?;
    wait_until_connected(&peripheral).await;
    let characteristic = discover_control(&peripheral).await;
    let _ = adapter.stop_scan().await;
    let Some(characteristic) = characteristic else {
        let _ = peripheral.disconnect().await;
        return Err("Could not find the Bluetooth control characteristic.".to_string());
    };
    if characteristic.properties.contains(CharPropFlags::NOTIFY) {
        let _ = peripheral.subscribe(&characteristic).await;
    }
    *state.connected.lock().await = Some(BleSession {
        peripheral,
        characteristic,
    });
    Ok(())
}

#[tauri::command]
pub async fn ble_send(state: tauri::State<'_, BleState>, bytes: Vec<u8>) -> Result<(), String> {
    let connected = state.connected.lock().await;
    let session = connected
        .as_ref()
        .ok_or_else(|| "No Bluetooth pedal is connected.".to_string())?;
    let write_type = if session
        .characteristic
        .properties
        .contains(CharPropFlags::WRITE_WITHOUT_RESPONSE)
    {
        WriteType::WithoutResponse
    } else {
        WriteType::WithResponse
    };
    session
        .peripheral
        .write(&session.characteristic, &bytes, write_type)
        .await
        .map_err(|_| "Could not send over Bluetooth.".to_string())
}

#[tauri::command]
pub async fn ble_close(state: tauri::State<'_, BleState>) -> Result<(), String> {
    let mut connected = state.connected.lock().await;
    if let Some(session) = connected.take() {
        let _ = session.peripheral.disconnect().await;
    }
    Ok(())
}
