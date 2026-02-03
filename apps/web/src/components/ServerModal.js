import { useEffect, useRef, useState } from "react";
export function ServerModal({ isOpen, status, port, onClose }) {
    const [actionPort, setActionPort] = useState(port.toString());
    const [isPerformingAction, setIsPerformingAction] = useState(false);
    const [logs, setLogs] = useState([]);
    const modalRef = useRef(null);
    useEffect(() => {
        setActionPort(port.toString());
    }, [port]);
    // Handle escape key
    useEffect(() => {
        if (!isOpen)
            return;
        const handleEscape = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);
    const handleStartServer = async () => {
        setIsPerformingAction(true);
        try {
            const tauri = await import("@tauri-apps/api/core");
            const portNum = parseInt(actionPort, 10);
            await tauri.invoke("start_server", { port: portNum });
            setLogs((prev) => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] Server started on port ${portNum}`,
            ]);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setLogs((prev) => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] Failed to start: ${message}`,
            ]);
        }
        finally {
            setIsPerformingAction(false);
        }
    };
    const handleStopServer = async () => {
        setIsPerformingAction(true);
        try {
            const tauri = await import("@tauri-apps/api/core");
            await tauri.invoke("stop_server");
            setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Server stopped`]);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setLogs((prev) => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] Failed to stop: ${message}`,
            ]);
        }
        finally {
            setIsPerformingAction(false);
        }
    };
    const handleRetryConnection = async () => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Checking connection...`]);
        try {
            const response = await fetch("/api/health");
            if (response.ok) {
                setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Connection successful`]);
            }
            else {
                setLogs((prev) => [
                    ...prev,
                    `[${new Date().toLocaleTimeString()}] Connection failed: ${response.status}`,
                ]);
            }
        }
        catch {
            setLogs((prev) => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] Connection failed: Network error`,
            ]);
        }
    };
    if (!isOpen)
        return null;
    return (<div className="modal-backdrop" role="dialog" aria-modal="true" ref={modalRef}>
      <div className="modal modal-content server-modal">
        <div className="modal-header">
          <h2 className="modal-title">Server Control</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Status Section */}
          <div className="settings-section">
            <h3 className="settings-section-title">Status</h3>
            <div className="server-status-display">
              <span className={`server-status-dot ${status}`}/>
              <span className="server-status-text">
                {status === "starting" && "Server is starting..."}
                {status === "running" && `Server is running on port ${port}`}
                {status === "stopped" && "Server is stopped"}
                {status === "error" && "Server error"}
              </span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="settings-section">
            <h3 className="settings-section-title">Actions</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="server-port">
                Port
              </label>
              <div className="form-row">
                <input id="server-port" type="number" className="form-input" value={actionPort} onChange={(e) => setActionPort(e.target.value)} min={1024} max={65535}/>
                <button type="button" className="primary-button" onClick={handleStartServer} disabled={isPerformingAction || status === "running"}>
                  {isPerformingAction ? "Starting..." : "Start"}
                </button>
                <button type="button" className="danger-button" onClick={handleStopServer} disabled={isPerformingAction || status === "stopped"}>
                  Stop
                </button>
              </div>
            </div>

            {status === "stopped" && (<button type="button" className="secondary-button" onClick={handleRetryConnection} style={{ width: "100%" }}>
                Retry Connection
              </button>)}
          </div>

          {/* Logs Section */}
          <div className="settings-section">
            <h3 className="settings-section-title">Logs</h3>
            <div className="server-logs">
              {logs.length === 0 ? (<div className="server-logs-empty">No logs yet</div>) : (logs.map((log, index) => (<div key={index} className="server-log-entry">
                    {log}
                  </div>)))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>);
}
