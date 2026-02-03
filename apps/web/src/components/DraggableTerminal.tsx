import { useRef } from "react";
import type { TerminalSession } from "../types";
import { TerminalTile } from "./TerminalTile";

interface DraggableTerminalProps {
  session: TerminalSession;
  wsUrl: string;
  onDelete: () => void;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
}

export function DraggableTerminal({
  session,
  wsUrl,
  onDelete,
  index,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDragOver,
}: DraggableTerminalProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    onDragStart(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOver(index);
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  return (
    <div
      ref={ref}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      className="draggable-terminal"
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: isDragOver ? "scale(1.02)" : undefined,
        transition: "transform 0.1s, opacity 0.1s",
      }}
    >
      <TerminalTile session={session} wsUrl={wsUrl} onDelete={onDelete} />
    </div>
  );
}
