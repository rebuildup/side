import { useEffect, useState } from "react";
const STATUS_MESSAGES = {
    init: "Initializing...",
    checking: "Checking server status...",
    starting: "Starting server...",
    ready: "Ready!",
    failed: "Failed to start server",
};
export function ServerStartupScreen({ onComplete }) {
    const [status, setStatus] = useState("init");
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState(null);
    useEffect(() => {
        let alive = true;
        let progressInterval = null;
        const runStartupSequence = async () => {
            // Step 1: Initialize
            if (alive) {
                setStatus("init");
                setProgress(10);
            }
            await sleep(500);
            // Step 2: Check server status
            if (alive) {
                setStatus("checking");
                setProgress(30);
            }
            await sleep(500);
            try {
                const tauri = await import("@tauri-apps/api/core");
                const result = (await tauri.invoke("get_server_status"));
                if (!alive)
                    return;
                if (result.running) {
                    // Server already running
                    setProgress(100);
                    setStatus("ready");
                    await sleep(500);
                    if (alive)
                        onComplete();
                    return;
                }
                // Step 3: Start server
                if (alive) {
                    setStatus("starting");
                    setProgress(50);
                    // Start progress animation
                    progressInterval = setInterval(() => {
                        setProgress((prev) => {
                            if (prev >= 90) {
                                clearInterval(progressInterval);
                                return 90;
                            }
                            return prev + 10;
                        });
                    }, 300);
                }
                await tauri.invoke("start_server", { port: 8787 });
                // Wait a bit for server to be ready
                await sleep(2000);
                if (!alive)
                    return;
                // Verify server is running
                const verifyResult = (await tauri.invoke("get_server_status"));
                if (verifyResult.running) {
                    if (progressInterval)
                        clearInterval(progressInterval);
                    setProgress(100);
                    setStatus("ready");
                    await sleep(500);
                    if (alive)
                        onComplete();
                }
                else {
                    throw new Error("Server failed to start");
                }
            }
            catch (error) {
                if (!alive)
                    return;
                if (progressInterval)
                    clearInterval(progressInterval);
                const message = error instanceof Error ? error.message : "Unknown error";
                setErrorMessage(message);
                setStatus("failed");
                setProgress(0);
            }
        };
        runStartupSequence();
        return () => {
            alive = false;
            if (progressInterval)
                clearInterval(progressInterval);
        };
    }, [onComplete]);
    const handleRetry = () => {
        setErrorMessage(null);
        // Rerun the startup sequence
        setStatus("init");
        setProgress(0);
    };
    return (<div className="server-startup-screen">
      <div className="startup-content">
        <div className="startup-logo">S-IDE</div>
        <div className="startup-version">v2.0.0</div>
        <div className="status-text">{STATUS_MESSAGES[status]}</div>
        {status !== "failed" && (<div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}/>
          </div>)}
        {status === "failed" && errorMessage && (<div className="startup-error">
            <p className="error-message">{errorMessage}</p>
            <button type="button" className="primary-button" onClick={handleRetry}>
              Retry
            </button>
          </div>)}
        {status === "ready" && <div className="startup-success">Launching application...</div>}
      </div>
    </div>);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
