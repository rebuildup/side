use tauri::Manager;
use std::path::PathBuf;
use std::process::Stdio;

const WINDOW_LABEL: &str = "main";
const DEFAULT_SERVER_PORT: u16 = 8787;

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

    // Auto-start server when app launches
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        // Wait a moment for the window to initialize
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Find and start the server
        match find_and_start_server().await {
            Ok(_) => {
                println!("[Desktop] Server started successfully on port {}", DEFAULT_SERVER_PORT);
            }
            Err(e) => {
                eprintln!("[Desktop] Failed to start server: {}", e);
                // Show error to user
                if let Some(window) = app_handle.get_webview_window(WINDOW_LABEL) {
                    let _ = window.eval(&format!("alert('Failed to start backend server: {}\\n\\nPlease make sure Node.js is installed and accessible.');", e));
                }
            }
        }
    });

    Ok(())
}

async fn find_and_start_server() -> Result<(), String> {
    // Try to find Node.js and start the server
    let node_cmd = find_node_command()?;

    // Determine server directory
    let server_dir = find_server_directory()?;

    // Start the server using node
    let mut cmd = tokio::process::Command::new(&node_cmd);
    cmd.current_dir(&server_dir);
    cmd.arg("dist/index.js")
        .arg("--port")
        .arg(DEFAULT_SERVER_PORT.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let child = cmd.spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    // The server process runs in background
    tokio::spawn(async move {
        match child.wait_with_output().await {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("[Desktop] Server process exited with error: {}", stderr);
                }
            }
            Err(e) => {
                eprintln!("[Desktop] Server process error: {}", e);
            }
        }
    });

    // Wait a bit for server to start
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Verify server is running
    let health_url = format!("http://localhost:{}/health", DEFAULT_SERVER_PORT);
    match tokio::process::Command::new("curl")
        .arg("-s")
        .arg("-o")
        .arg("nul")
        .arg(&health_url)
        .output()
        .await
    {
        Ok(_) => Ok(()),
        Err(_) => Err("Server did not respond to health check".to_string()),
    }
}

fn find_node_command() -> Result<String, String> {
    // Try common Node.js command names
    let candidates = ["node", "node.exe"];

    for cmd in candidates {
        if which::which(cmd).is_ok() {
            return Ok(cmd.to_string());
        }
    }

    Err("Node.js not found in PATH. Please install Node.js to run the backend server.".to_string())
}

fn find_server_directory() -> Result<PathBuf, String> {
    // In production, the server should be bundled relative to the exe
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    let mut server_path = exe_path;
    server_path.pop(); // Remove exe name

    // In development, go up to find the project root
    // In production, server should be in a known relative path
    #[cfg(debug_assertions)]
    {
        // Development: search up for project root
        for _ in 0..10 {
            let server_dir = server_path.join("apps").join("server");
            if server_dir.exists() && server_dir.join("package.json").exists() {
                return Ok(server_dir);
            }
            if !server_path.pop() {
                break;
            }
        }
        Err("Could not find server directory. Please run from the project root.".to_string())
    }

    #[cfg(not(debug_assertions))]
    {
        // Production: server is bundled in resources/server/
        // Structure: side-desktop.exe -> resources/server/dist/index.js
        let resources_dir = server_path.join("resources");
        Ok(resources_dir.join("server"))
    }
}
