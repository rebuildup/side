import { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";

interface TitleBarProps {
  onOpenSettings?: () => void;
  onOpenServerModal?: () => void;
  onToggleContextStatus?: () => void;
}

export function TitleBar({ onOpenSettings, onOpenServerModal, onToggleContextStatus }: TitleBarProps) {
  const [isTauri, setIsTauri] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);

  useEffect(() => {
    // Check if running in Tauri environment
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window);

    // Check initial mobile mode based on screen width
    const checkMobileMode = () => {
      setIsMobileMode(window.innerWidth < 768);
    };

    checkMobileMode();
    window.addEventListener("resize", checkMobileMode);
    return () => window.removeEventListener("resize", checkMobileMode);
  }, []);

  const handleClose = async () => {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.close();
  };

  const handleMinimize = async () => {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.minimize();
  };

  const handleMaximize = async () => {
    if (!isTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = await getCurrentWindow();
    await win.toggleMaximize();
  };

  const handleToggleMobileMode = () => {
    setIsMobileMode((prev) => !prev);
  };

  return (
    <div className={`title-bar ${isTauri ? "title-bar--tauri" : ""} ${isMobileMode ? "title-bar--mobile" : ""}`}>
      {/* Left side - mobile mode toggle or empty */}
      <div className="title-bar-left" data-tauri-drag-region={isTauri}>
        <button
          type="button"
          className="title-bar-mobile-toggle"
          onClick={handleToggleMobileMode}
          title={isMobileMode ? "デスクトップモード" : "モバイルモード"}
          aria-label="Toggle mobile mode"
        >
          <Smartphone size={14} />
          <span className="mobile-mode-label">{isMobileMode ? "Desktop" : "Mobile"}</span>
        </button>
      </div>

      {/* Menu items - VSCode style, draggable */}
      <div className="title-bar-menu" data-tauri-drag-region={isTauri}>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: File menu */}}
        >
          File
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: Edit menu */}}
        >
          Edit
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: Selection menu */}}
        >
          Selection
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: View menu */}}
        >
          View
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: Go menu */}}
        >
          Go
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: Run menu */}}
        >
          Run
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: Terminal menu */}}
        >
          Terminal
        </button>
        <button
          className="title-bar-menu-item"
          data-tauri-drag-region={false}
          onClick={() => {/* TODO: Help menu */}}
        >
          Help
        </button>
      </div>

      {/* Window controls - only show in Tauri */}
      {isTauri && (
        <div className="title-bar-controls">
          <button
            type="button"
            className="title-bar-button"
            data-tauri-drag-region={false}
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <span>&#8722;</span>
          </button>
          <button
            type="button"
            className="title-bar-button"
            data-tauri-drag-region={false}
            onClick={handleMaximize}
            aria-label="Maximize"
          >
            <span>&#9633;</span>
          </button>
          <button
            type="button"
            className="title-bar-button title-bar-close"
            data-tauri-drag-region={false}
            onClick={handleClose}
            aria-label="Close"
          >
            <span>&#10005;</span>
          </button>
        </div>
      )}
    </div>
  );
}
