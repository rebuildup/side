import { useEffect, useState } from "react";
import { Globe, Loader2, Copy, Check, Power, PowerOff } from "lucide-react";
import { useTunnelStatus } from "../hooks/useTunnelStatus";

export function TunnelControl() {
  const tunnelStatus = useTunnelStatus();
  const [isTauri, setIsTauri] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window);
  }, []);

  const handleStartTunnel = async () => {
    if (!isTauri) return;
    setStarting(true);
    try {
      const tauri = await import("@tauri-apps/api/core");
      const serverPort = 5176; // Vite dev server port
      await tauri.invoke("start_tunnel", { port: serverPort });
    } catch (e) {
      console.error("Failed to start tunnel:", e);
    } finally {
      setStarting(false);
    }
  };

  const handleStopTunnel = async () => {
    if (!isTauri) return;
    try {
      const tauri = await import("@tauri-apps/api/core");
      await tauri.invoke("stop_tunnel");
    } catch (e) {
      console.error("Failed to stop tunnel:", e);
    }
  };

  const handleCopyUrl = async () => {
    if (!tunnelStatus.url) return;
    try {
      await navigator.clipboard.writeText(tunnelStatus.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy URL:", e);
    }
  };

  if (!isTauri) {
    return null;
  }

  return (
    <div className="tunnel-control">
      <div className="tunnel-status">
        <Globe size={14} />
        <span className="tunnel-label">
          {tunnelStatus.running ? "Remote Access" : "No Remote Access"}
        </span>
        {tunnelStatus.running && tunnelStatus.url && (
          <span className="tunnel-url">
            <button
              type="button"
              className="copy-url-btn"
              onClick={handleCopyUrl}
              title={copied ? "Copied!" : "Copy URL"}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <span className="url-text">{tunnelStatus.url}</span>
          </span>
        )}
      </div>
      <div className="tunnel-actions">
        {starting ? (
          <Loader2 size={14} className="spinner" />
        ) : tunnelStatus.running ? (
          <button
            type="button"
            className="tunnel-btn stop"
            onClick={handleStopTunnel}
            title="Stop tunnel"
          >
            <PowerOff size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="tunnel-btn start"
            onClick={handleStartTunnel}
            title="Start tunnel for remote access"
          >
            <Power size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
