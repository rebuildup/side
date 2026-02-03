import { useEffect, useState } from "react";

export interface TunnelStatus {
  running: boolean;
  url: string | null;
}

export function useTunnelStatus(): TunnelStatus {
  const [running, setRunning] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const checkStatus = async () => {
      try {
        const tauri = await import("@tauri-apps/api/core");
        const result = (await tauri.invoke("get_tunnel_status")) as {
          running: boolean;
          url: string | null;
        };

        if (!alive) return;

        setRunning(result.running);
        setUrl(result.url);
      } catch {
        // Not in Tauri environment
        if (alive) {
          setRunning(false);
          setUrl(null);
        }
      }
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return { running, url };
}
