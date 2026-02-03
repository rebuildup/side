use tokio::process::{Command, Child};
use std::path::PathBuf;

pub struct ServerHandle {
    child: Child,
    pub port: u16,
}

// Path to the bundled Node.js server executable
fn get_server_path() -> PathBuf {
    let exe_path = std::env::current_exe()
        .expect("Failed to get exe path");

    let exe_dir = exe_path.parent().expect("Failed to get exe directory");

    // In development/release builds, go up from target/debug or target/release to src-tauri
    let mut current: PathBuf = exe_dir.to_path_buf();

    // Try going up multiple levels to find src-tauri
    for _ in 0..5 {
        // Check if src-tauri exists at this level
        let src_tauri = current.join("src-tauri");
        if src_tauri.exists() {
            let server_path = src_tauri.join("resources").join("server").join("index.js");
            if server_path.exists() {
                return server_path;
            }
        }

        // Check if resources/server exists directly at this level
        let server_path = current.join("resources").join("server").join("index.js");
        if server_path.exists() {
            return server_path;
        }

        // Go up one level
        match current.parent() {
            Some(p) => current = p.to_path_buf(),
            None => break,
        };
    }

    // Fallback to exe_dir/resources/server
    exe_dir.join("resources").join("server").join("index.js")
}

pub async fn start(port: u16) -> Result<ServerHandle, String> {
    // Check if we're in development mode
    if is_development_mode() {
        start_dev_server(port).await
    } else {
        start_production_server(port).await
    }
}

pub async fn stop(mut handle: ServerHandle) -> Result<(), String> {
    handle.child.kill()
        .await
        .map_err(|e| format!("Failed to stop server: {}", e))?;
    Ok(())
}

fn is_development_mode() -> bool {
    // Check if we're running in development environment
    std::env::var("TAURI_DEV")
        .or_else(|_| std::env::var("DEBUG"))
        .is_ok()
        || !std::env::current_exe()
            .map(|p| p.extension().is_some())
            .unwrap_or(false)
}

async fn start_dev_server(port: u16) -> Result<ServerHandle, String> {
    // Find the project root (where package.json exists)
    let project_root = find_project_root()
        .map_err(|e| format!("Failed to find project root: {}", e))?;

    let server_dir = project_root.join("apps").join("server");

    // Use npm to run the server in development mode
    let child = Command::new("npm")
        .current_dir(&server_dir)
        .arg("run")
        .arg("dev")
        .spawn()
        .map_err(|e| format!("Failed to start dev server: {}. Ensure npm is in PATH", e))?;

    Ok(ServerHandle { child, port })
}

async fn start_production_server(port: u16) -> Result<ServerHandle, String> {
    let server_path = get_server_path();

    if !server_path.exists() {
        return Err(format!(
            "Server executable not found at: {}. Ensure resources are bundled correctly.",
            server_path.display()
        ));
    }

    // Use Node.js to run the bundled server
    let node_path = find_node_executable()?;

    // Convert paths to strings (don't canonicalize to avoid path issues)
    let node_exe = node_path.to_string_lossy().to_string();
    let server_script = server_path.to_string_lossy().to_string();

    let child = Command::new(&node_exe)
        .arg(&server_script)
        .env("PORT", port.to_string())
        .spawn()
        .map_err(|e| format!("Failed to start server: {} (node: '{}', script: '{}')", e, node_exe, server_script))?;

    Ok(ServerHandle { child, port })
}

fn find_node_executable() -> Result<PathBuf, String> {
    // TEMP: Return hardcoded path for now
    // TODO: Make this dynamic after verifying it works
    Ok(PathBuf::from(r"C:\Program Files\nodejs\node.exe"))
}

fn find_project_root() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {}", e))?;

    let mut path = current_dir;

    // Search up for package.json
    for _ in 0..10 {
        let package_json = path.join("package.json");
        if package_json.exists() {
            return Ok(path);
        }
        if !path.pop() {
            break;
        }
    }

    // Fallback: try relative paths from the exe
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    let mut search_path = exe_path;
    search_path.pop();

    // In dev, exe is in target/debug, go up to project root
    for _ in 0..5 {
        let package_json = search_path.join("package.json");
        if package_json.exists() {
            return Ok(search_path);
        }
        if !search_path.pop() {
            break;
        }
    }

    Err("Could not find project root (package.json)".to_string())
}
