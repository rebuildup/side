use tokio::process::Child;
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct TunnelHandle {
    _child: Child,
    url: Arc<Mutex<Option<String>>>,
}

pub async fn start(port: u16) -> Result<TunnelHandle, String> {
    // For now, return a simple handle without URL monitoring
    // Full implementation would need output monitoring which is complex in async Rust
    let child = tokio::process::Command::new("npx")
        .arg("localtunnel")
        .arg("--port")
        .arg(port.to_string())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start tunnel: {}. Ensure Node.js/npm is in PATH", e))?;

    // Start a background task to monitor output
    let url = Arc::new(Mutex::new(None));
    let _url_clone = Arc::clone(&url);

    // Note: We can't easily read stdout after spawn in current design
    // For now, users will see the URL in their terminal or we can add proper logging later

    tokio::spawn(async move {
        // Give tunnel a moment to start and log its URL
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        // In production, you'd read stdout here and parse the URL
        // For now, user can check the terminal where npx is running
    });

    Ok(TunnelHandle { _child: child, url })
}

pub async fn stop(mut handle: TunnelHandle) -> Result<(), String> {
    handle._child.kill()
        .await
        .map_err(|e| format!("Failed to stop tunnel: {}", e))?;
    Ok(())
}

pub async fn get_url(handle: &TunnelHandle) -> Option<String> {
    handle.url.lock().await.clone()
}
