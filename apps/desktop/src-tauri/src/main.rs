// Prevents additional console window on Windows in release builds
// Temporarily disabled for debugging
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod server;
mod tunnel;
mod window;

use tokio::sync::Mutex as TokioMutex;

type ServerStateInner = TokioMutex<Option<server::ServerHandle>>;
type TunnelStateInner = TokioMutex<Option<tunnel::TunnelHandle>>;

struct ServerState(ServerStateInner);
struct TunnelState(TunnelStateInner);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerState(TokioMutex::new(None)))
        .manage(TunnelState(TokioMutex::new(None)))
        .setup(|app| {
            window::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_server,
            commands::stop_server,
            commands::get_server_status,
            commands::get_server_logs,
            commands::start_tunnel,
            commands::stop_tunnel,
            commands::get_tunnel_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
