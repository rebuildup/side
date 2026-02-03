use crate::server::{self, ServerHandle};
use crate::ServerState;
use tauri::State;

#[tauri::command]
pub async fn start_server(
    state: State<'_, ServerState>,
    port: u16,
) -> Result<String, String> {
    let mut server_state = state.0.lock().unwrap();
    if server_state.is_some() {
        return Err("Server is already running".to_string());
    }

    let handle = server::start(port).await.map_err(|e| e.to_string())?;
    *server_state = Some(handle);
    Ok(format!("Server started on port {}", port))
}

#[tauri::command]
pub async fn stop_server(state: State<'_, ServerState>) -> Result<String, String> {
    let mut server_state = state.0.lock().unwrap();
    if server_state.is_none() {
        return Err("Server is not running".to_string());
    }

    let handle = server_state.take().unwrap();
    server::stop(handle).await.map_err(|e| e.to_string())?;
    Ok("Server stopped".to_string())
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, ServerState>) -> Result<ServerStatus, String> {
    let server_state = state.0.lock().unwrap();
    let running = server_state.is_some();
    let port = server_state.as_ref().map(|h| h.port).unwrap_or(8080);
    Ok(ServerStatus { running, port })
}

#[tauri::command]
pub async fn get_server_logs() -> Result<Vec<String>, String> {
    // TODO: Implement actual log file reading
    // Read from server log file and return lines
    Ok(vec!["Server logging not yet implemented".to_string()])
}

#[derive(serde::Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
}
