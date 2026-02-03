import { useRef } from "react";
import { TerminalTile } from "./TerminalTile";
export function DraggableTerminal({ session, wsUrl, onDelete, index, onDragStart, onDragOver, onDragEnd, isDragging, isDragOver, }) {
    const ref = useRef(null);
    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(index);
    };
    const handleDragEnd = () => {
        onDragEnd();
    };
    return (<div ref={ref} draggable onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} className="draggable-terminal" style={{
            opacity: isDragging ? 0.5 : 1,
            transform: isDragOver ? "scale(1.02)" : undefined,
            transition: "transform 0.1s, opacity 0.1s",
        }}>
      <TerminalTile session={session} wsUrl={wsUrl} onDelete={onDelete}/>
    </div>);
}
