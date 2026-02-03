use tauri::{AppHandle, Manager};

const WINDOW_LABEL: &str = "main";

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the main window
    let window = app.get_webview_window(WINDOW_LABEL)
        .ok_or("Main window not found")?;

    // Setup window behavior
    window.on_window_event(|event| match event {
        tauri::WindowEvent::CloseRequested { .. } => {
            // For now, allow window to close
            // TODO: Implement tray icon with minimize-to-tray behavior
        }
        _ => {}
    });

    Ok(())
}
