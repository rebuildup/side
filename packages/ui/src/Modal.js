import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
export const Modal = ({ isOpen, onClose, title, children, className = "", }) => {
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement;
            const modal = modalRef.current;
            if (modal) {
                const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                const firstElement = focusableElements[0];
                if (firstElement)
                    firstElement.focus();
            }
            document.body.style.overflow = "hidden";
        }
        return () => {
            // Cleanup: restore overflow on unmount
            document.body.style.overflow = "";
            if (previousActiveElement.current) {
                previousActiveElement.current.focus();
            }
        };
    }, [isOpen]);
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape" && isOpen)
                onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return createPortal(<div onClick={handleBackdropClick} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div ref={modalRef} className={`bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto ${className}`} role="dialog" aria-modal="true" aria-labelledby={title ? "modal-title" : undefined}>
        {title && (<div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 id="modal-title" className="text-xl font-semibold text-white">
              {title}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close modal">
              ✕
            </button>
          </div>)}
        <div className="p-4">{children}</div>
      </div>
    </div>, document.body);
};
