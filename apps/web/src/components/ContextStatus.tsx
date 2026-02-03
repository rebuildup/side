import React, { useState, useEffect } from 'react';

// Types
interface ContextStatus {
  healthScore: number;
  driftScore: number;
  currentPhase: string;
  messageCount: number;
  tokenCount: number;
  recommendations?: string[];
}

interface ContextStatusProps {
  compact?: boolean;
  onStatusChange?: (status: ContextStatus) => void;
}

// API client
const api = {
  getStatus: async (): Promise<ContextStatus> => {
    const response = await fetch('/api/context-manager/status');
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  },

  compact: async (): Promise<void> => {
    const response = await fetch('/api/context-manager/compact', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to compact');
  },

  snapshot: async (): Promise<void> => {
    const response = await fetch('/api/context-manager/snapshot', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to create snapshot');
  },
};

// Health score color coding
function getHealthColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) return { bg: '#22c55e', text: '#166534', label: 'Excellent' };
  if (score >= 50) return { bg: '#eab308', text: '#854d0e', label: 'Good' };
  if (score >= 30) return { bg: '#f97316', text: '#9a3412', label: 'Warning' };
  return { bg: '#ef4444', text: '#991b1b', label: 'Critical' };
}

// Drift score color coding
function getDriftColor(score: number): string {
  if (score >= 0.7) return '#ef4444';
  if (score >= 0.4) return '#f97316';
  return '#22c55e';
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    minWidth: '280px',
    maxWidth: '400px',
  },
  compactContainer: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
  },
  header: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e5e5e5',
    margin: 0,
  },
  healthSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  healthHeader: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'space-between',
  },
  healthScore: {
    fontSize: '24px',
    fontWeight: 700,
  },
  healthLabel: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  },
  gaugeContainer: {
    height: '8px',
    borderRadius: '4px',
    backgroundColor: '#333',
    overflow: 'hidden' as const,
  },
  gaugeBar: {
    height: '100%',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#2a2a2a',
  },
  metricLabel: {
    fontSize: '11px',
    color: '#a3a3a3',
    textTransform: 'uppercase' as const,
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e5e5e5',
  },
  recommendations: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '10px',
    borderRadius: '4px',
    backgroundColor: '#2a2a2a',
    borderLeft: '3px solid',
  },
  recommendationsTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e5e5e5',
    margin: '0 0 4px 0',
  },
  recommendation: {
    fontSize: '12px',
    color: '#d4d4d4',
    margin: 0,
    paddingLeft: '12px',
    position: 'relative' as const,
  },
  recommendationBefore: {
    content: '"•"',
    position: 'absolute' as const,
    left: 0,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  button: {
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  },
  buttonSecondary: {
    backgroundColor: '#404040',
    color: '#e5e5e5',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
  },
  compactHealthBar: {
    width: '60px',
    height: '6px',
    borderRadius: '3px',
    backgroundColor: '#333',
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  compactMetric: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
  },
  compactLabel: {
    fontSize: '10px',
    color: '#a3a3a3',
  },
  compactValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e5e5e5',
  },
  loading: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: '20px',
    color: '#a3a3a3',
    fontSize: '14px',
  },
  error: {
    padding: '12px',
    borderRadius: '4px',
    backgroundColor: '#7f1d1d',
    color: '#fecaca',
    fontSize: '12px',
  },
};

// Component
export const ContextStatus: React.FC<ContextStatusProps> = ({ compact = false, onStatusChange }) => {
  const [status, setStatus] = useState<ContextStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStatus();
      setStatus(data);
      onStatusChange?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleCompact = async () => {
    try {
      setActionLoading('compact');
      await api.compact();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compact');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnapshot = async () => {
    try {
      setActionLoading('snapshot');
      await api.snapshot();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !status) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (error && !status) {
    return <div style={styles.error}>{error}</div>;
  }

  if (!status) return null;

  const healthColor = getHealthColor(status.healthScore);
  const driftColor = getDriftColor(status.driftScore);
  const showNewSession = status.driftScore > 0.5;
  const showRecommendations = status.healthScore < 50 && status.recommendations && status.recommendations.length > 0;

  // Compact mode
  if (compact) {
    return (
      <div style={styles.compactContainer}>
        <div style={styles.compactHealthBar}>
          <div
            style={{
              ...styles.gaugeBar,
              width: `${status.healthScore}%`,
              backgroundColor: healthColor.bg,
            }}
          />
        </div>
        <div style={styles.compactMetric}>
          <span style={styles.compactLabel}>Health</span>
          <span style={{ ...styles.compactValue, color: healthColor.text }}>{status.healthScore}</span>
        </div>
        <div style={styles.compactMetric}>
          <span style={styles.compactLabel}>Drift</span>
          <span style={{ ...styles.compactValue, color: driftColor }}>{(status.driftScore * 100).toFixed(0)}%</span>
        </div>
        <button
          onClick={handleCompact}
          disabled={actionLoading !== null}
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            opacity: actionLoading ? 0.6 : 1,
          }}
          title="Compact context"
        >
          {actionLoading === 'compact' ? '...' : '⚡'}
        </button>
      </div>
    );
  }

  // Full mode
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Context Manager</h3>
        <span
          style={{
            ...styles.healthLabel,
            backgroundColor: healthColor.bg,
            color: healthColor.text,
          }}
        >
          {healthColor.label}
        </span>
      </div>

      {/* Health Score Gauge */}
      <div style={styles.healthSection}>
        <div style={styles.healthHeader}>
          <span style={styles.metricLabel}>Health Score</span>
          <span style={{ ...styles.healthScore, color: healthColor.text }}>
            {status.healthScore}
          </span>
        </div>
        <div style={styles.gaugeContainer}>
          <div
            style={{
              ...styles.gaugeBar,
              width: `${status.healthScore}%`,
              backgroundColor: healthColor.bg,
            }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={styles.metrics}>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Drift Score</span>
          <span style={{ ...styles.metricValue, color: driftColor }}>
            {status.driftScore.toFixed(2)}
          </span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Phase</span>
          <span style={styles.metricValue}>{status.currentPhase}</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Messages</span>
          <span style={styles.metricValue}>{status.messageCount}</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Tokens</span>
          <span style={styles.metricValue}>{status.tokenCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Recommendations */}
      {showRecommendations && status.recommendations && (
        <div style={{ ...styles.recommendations, borderLeftColor: healthColor.bg }}>
          <p style={styles.recommendationsTitle}>Recommendations</p>
          {status.recommendations.map((rec, idx) => (
            <p key={idx} style={styles.recommendation}>
              {rec}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button
          onClick={handleCompact}
          disabled={actionLoading !== null}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            opacity: actionLoading ? 0.6 : 1,
          }}
        >
          {actionLoading === 'compact' ? 'Compacting...' : 'Compact'}
        </button>
        <button
          onClick={handleSnapshot}
          disabled={actionLoading !== null}
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            opacity: actionLoading ? 0.6 : 1,
          }}
        >
          {actionLoading === 'snapshot' ? 'Snapshotting...' : 'Snapshot'}
        </button>
        {showNewSession && (
          <button
            onClick={() => window.location.reload()}
            style={{
              ...styles.button,
              ...styles.buttonDanger,
            }}
          >
            New Session
          </button>
        )}
      </div>

      {/* Error message */}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
};

export default ContextStatus;
