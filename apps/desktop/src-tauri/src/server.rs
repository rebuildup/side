use tokio::process::{Command, Child};
use std::path::PathBuf;

pub struct ServerHandle {
    child: Child,
    pub port: u16,
}

pub async fn start(port: u16) -> Result<ServerHandle, String> {
    let server_path = get_server_executable_path().await?;

    let child = Command::new(&server_path)
        .arg("--port")
        .arg(port.to_string())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    Ok(ServerHandle { child, port })
}

pub async fn stop(handle: ServerHandle) -> Result<(), String> {
    handle.child.kill()
        .await
        .map_err(|e| format!("Failed to stop server: {}", e))?;
    Ok(())
}

async fn get_server_executable_path() -> Result<PathBuf, String> {
    // In development, use the local server
    // In production, use the bundled server
    let mut exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    exe_path.pop(); // Remove exe name
    exe_path.push("server");

    #[cfg(windows)]
    {
        exe_path.set_extension("exe");
    }

    Ok(exe_path)
}
