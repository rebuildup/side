const STATUS_TEXT = {
    starting: "Starting...",
    running: "Connected",
    stopped: "Stopped",
    error: "Error",
};
export function ServerStatus({ status, port }) {
    return (<span className="server-status-indicator">
      <span className={`server-status-dot ${status}`}/>
      <span>Server: {STATUS_TEXT[status]}</span>
      {status === "running" && <span className="server-port">:{port}</span>}
    </span>);
}
