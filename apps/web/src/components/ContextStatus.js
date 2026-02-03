import { useEffect, useState } from "react";
// API client
const api = {
    getStatus: async () => {
        const response = await fetch("/api/context-manager/status");
        if (!response.ok)
            throw new Error("Failed to fetch status");
        return response.json();
    },
    compact: async () => {
        const response = await fetch("/api/context-manager/compact", { method: "POST" });
        if (!response.ok)
            throw new Error("Failed to compact");
    },
    snapshot: async () => {
        const response = await fetch("/api/context-manager/snapshot", { method: "POST" });
        if (!response.ok)
            throw new Error("Failed to create snapshot");
    },
};
// Health score color coding - returns CSS class name and display info
function getHealthInfo(score) {
    if (score >= 80)
        return { className: "excellent", label: "Excellent", color: "#4caf50" };
    if (score >= 50)
        return { className: "good", label: "Good", color: "#8bc34a" };
    if (score >= 30)
        return { className: "warning", label: "Warning", color: "#ff9800" };
    return { className: "critical", label: "Critical", color: "#f44336" };
}
// Drift score color coding
function getDriftColor(score) {
    if (score >= 0.7)
        return "#f44336";
    if (score >= 0.4)
        return "#ff9800";
    return "#4caf50";
}
// Helper to get health class CSS class
function getHealthClass(score) {
    const info = getHealthInfo(score);
    return `context-health-fill ${info.className}`;
}
// Inline styles for dynamic values (colors, widths, etc.)
const dynamicStyles = {
    compactContainer: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 12px",
        borderRadius: "6px",
        backgroundColor: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
    },
    compactHealthBar: {
        width: "60px",
        height: "6px",
        borderRadius: "3px",
        backgroundColor: "var(--bg-soft)",
        overflow: "hidden",
    },
    compactHealthFill: (width, color) => ({
        height: "100%",
        width: `${width}%`,
        backgroundColor: color,
        borderRadius: "3px",
        transition: "width 0.3s ease, background-color 0.3s ease",
    }),
    compactMetric: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
    },
    compactLabel: {
        fontSize: "10px",
        color: "var(--ink-muted)",
    },
    compactValue: (color) => ({
        fontSize: "14px",
        fontWeight: 600,
        color: color,
    }),
    compactButton: {
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        backgroundColor: "var(--bg-soft)",
        color: "var(--ink)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        minWidth: "28px",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
    },
    title: {
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--ink)",
        margin: 0,
    },
    healthLabel: (color) => ({
        fontSize: "11px",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "4px",
        textTransform: "uppercase",
        backgroundColor: color,
        color: "#000",
    }),
    healthScoreDisplay: {
        fontSize: "24px",
        fontWeight: 700,
    },
    metricValueColored: (color) => ({
        fontSize: "14px",
        fontWeight: 600,
        color: color,
    }),
    recommendations: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "10px",
        borderRadius: "4px",
        backgroundColor: "var(--bg-soft)",
        borderLeft: "3px solid",
    },
    recommendationsTitle: {
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--ink)",
        margin: "0 0 4px 0",
    },
    recommendation: {
        fontSize: "12px",
        color: "var(--ink-dim)",
        margin: 0,
        paddingLeft: "12px",
        position: "relative",
    },
    loading: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        color: "var(--ink-muted)",
        fontSize: "14px",
    },
    error: {
        padding: "12px",
        borderRadius: "4px",
        backgroundColor: "#7f1d1d",
        color: "#fecaca",
        fontSize: "12px",
    },
};
// Component
export const ContextStatus = ({ compact = false, onStatusChange, }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const fetchStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getStatus();
            setStatus(data);
            onStatusChange?.(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch status");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchStatus]);
    const handleCompact = async () => {
        try {
            setActionLoading("compact");
            await api.compact();
            await fetchStatus();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to compact");
        }
        finally {
            setActionLoading(null);
        }
    };
    const handleSnapshot = async () => {
        try {
            setActionLoading("snapshot");
            await api.snapshot();
            await fetchStatus();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create snapshot");
        }
        finally {
            setActionLoading(null);
        }
    };
    if (loading && !status) {
        return <div style={dynamicStyles.loading}>Loading...</div>;
    }
    if (error && !status) {
        return <div style={dynamicStyles.error}>{error}</div>;
    }
    if (!status)
        return null;
    const healthInfo = getHealthInfo(status.healthScore);
    const driftColor = getDriftColor(status.driftScore);
    const showNewSession = status.driftScore > 0.5;
    const showRecommendations = status.healthScore < 50 && status.recommendations && status.recommendations.length > 0;
    // Compact mode
    if (compact) {
        return (<div style={dynamicStyles.compactContainer}>
        <div style={dynamicStyles.compactHealthBar}>
          <div style={dynamicStyles.compactHealthFill(status.healthScore, healthInfo.color)}/>
        </div>
        <div style={dynamicStyles.compactMetric}>
          <span style={dynamicStyles.compactLabel}>Health</span>
          <span style={dynamicStyles.compactValue(healthInfo.color)}>{status.healthScore}</span>
        </div>
        <div style={dynamicStyles.compactMetric}>
          <span style={dynamicStyles.compactLabel}>Drift</span>
          <span style={dynamicStyles.compactValue(driftColor)}>
            {(status.driftScore * 100).toFixed(0)}%
          </span>
        </div>
        <button onClick={handleCompact} disabled={actionLoading !== null} style={{
                ...dynamicStyles.compactButton,
                opacity: actionLoading ? 0.6 : 1,
            }} title="Compact context">
          {actionLoading === "compact" ? "..." : "⚡"}
        </button>
      </div>);
    }
    // Full mode
    return (<div className="context-status">
      {/* Header */}
      <div style={dynamicStyles.header}>
        <h3 style={dynamicStyles.title}>Context Manager</h3>
        <span style={dynamicStyles.healthLabel(healthInfo.color)}>{healthInfo.label}</span>
      </div>

      {/* Health Score Gauge */}
      <div className="context-health-gauge">
        <div className="context-health-bar">
          <div className={getHealthClass(status.healthScore)} style={{ width: `${status.healthScore}%` }}/>
        </div>
        <span style={{ ...dynamicStyles.healthScoreDisplay, color: healthInfo.color }}>
          {status.healthScore}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="context-metrics">
        <div className="context-metric">
          <span className="context-metric-label">Drift Score</span>
          <span className="context-metric-value" style={{ color: driftColor }}>
            {status.driftScore.toFixed(2)}
          </span>
        </div>
        <div className="context-metric">
          <span className="context-metric-label">Phase</span>
          <span className="context-metric-value">{status.currentPhase}</span>
        </div>
        <div className="context-metric">
          <span className="context-metric-label">Messages</span>
          <span className="context-metric-value">{status.messageCount}</span>
        </div>
        <div className="context-metric">
          <span className="context-metric-label">Tokens</span>
          <span className="context-metric-value">{status.tokenCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Recommendations */}
      {showRecommendations && status.recommendations && (<div style={{ ...dynamicStyles.recommendations, borderLeftColor: healthInfo.color }}>
          <p style={dynamicStyles.recommendationsTitle}>Recommendations</p>
          {status.recommendations.map((rec, idx) => (<p key={idx} style={dynamicStyles.recommendation}>
              {rec}
            </p>))}
        </div>)}

      {/* Actions */}
      <div className="context-actions">
        <button className="context-action-btn primary" onClick={handleCompact} disabled={actionLoading !== null} style={{ opacity: actionLoading ? 0.6 : 1 }}>
          {actionLoading === "compact" ? "Compacting..." : "Compact"}
        </button>
        <button className="context-action-btn" onClick={handleSnapshot} disabled={actionLoading !== null} style={{ opacity: actionLoading ? 0.6 : 1 }}>
          {actionLoading === "snapshot" ? "Snapshotting..." : "Snapshot"}
        </button>
        {showNewSession && (<button className="context-action-btn danger" onClick={() => window.location.reload()}>
            New Session
          </button>)}
      </div>

      {/* Error message */}
      {error && <div style={dynamicStyles.error}>{error}</div>}
    </div>);
};
export default ContextStatus;
