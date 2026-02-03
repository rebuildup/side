import { useEffect, useState } from "react";
export function useServerStatus() {
    const [status, setStatus] = useState("starting");
    const [port, setPort] = useState(8787);
    const [error, setError] = useState();
    useEffect(() => {
        let alive = true;
        const checkStatus = async () => {
            try {
                const tauri = await import("@tauri-apps/api/core");
                const result = (await tauri.invoke("get_server_status"));
                if (!alive)
                    return;
                if (result.running) {
                    setStatus("running");
                    setPort(result.port);
                    setError(undefined);
                }
                else {
                    setStatus("stopped");
                    setPort(result.port);
                    setError(undefined);
                }
            }
            catch {
                // Not in Tauri environment, assume API is available (web mode)
                if (alive) {
                    setStatus("running");
                    setError(undefined);
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
    return { status, port, error };
}
