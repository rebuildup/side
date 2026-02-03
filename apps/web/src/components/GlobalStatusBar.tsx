import { type ReactNode, useMemo } from "react";

interface GlobalStatusBarProps {
  serverStatus?: ReactNode;
  tunnelControl?: ReactNode;
  activeTerminalsCount?: number;
  contextHealthScore?: number;
  onToggleContextStatus?: () => void;
}

// Type definition for performance.memory API (Chrome-specific)
interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export function GlobalStatusBar({
  serverStatus,
  tunnelControl,
  activeTerminalsCount = 0,
  contextHealthScore = 100,
  onToggleContextStatus,
}: GlobalStatusBarProps) {
  // Get memory usage if available
  const memoryUsage = useMemo(() => {
    const perf = performance as PerformanceWithMemory;
    if (typeof performance !== "undefined" && perf.memory) {
      const mem = perf.memory;
      const used = Math.round(mem.usedJSHeapSize / 1024 / 1024);
      const total = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
      return `${used}MB/${total}MB`;
    }
    return null;
  }, []);

  // Get health color
  const getHealthColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 50) return "#eab308";
    if (score >= 30) return "#f97316";
    return "#ef4444";
  };

  const healthColor = getHealthColor(contextHealthScore);

  return (
    <div className="global-status-bar">
      <div className="global-statusbar-left">
        {serverStatus || (
          <span className="statusbar-item">
            <span className="status-indicator status-online"></span>
            Server: Connected
          </span>
        )}
        {tunnelControl}
        {onToggleContextStatus && (
          <button
            className="statusbar-item statusbar-clickable"
            onClick={onToggleContextStatus}
            title="View context manager status"
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="status-indicator" style={{ backgroundColor: healthColor }}></span>
            Context: {contextHealthScore}%
          </button>
        )}
      </div>
      <div className="global-statusbar-right">
        <span className="statusbar-item">WebSocket: Active</span>
        <span className="statusbar-item">Terminals: {activeTerminalsCount}</span>
        {memoryUsage && <span className="statusbar-item">Memory: {memoryUsage}</span>}
      </div>
    </div>
  );
}
