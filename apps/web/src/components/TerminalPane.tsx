import { useMemo, useState, useCallback } from 'react';
import type { TerminalSession, TerminalGroup } from '../types';
import { TerminalTile } from './TerminalTile';
import { DraggableTerminal } from './DraggableTerminal';
import { TerminalGroupHeader } from './TerminalGroupHeader';

interface TerminalPaneProps {
  terminals: TerminalSession[];
  wsBase: string;
  deckId: string;
  onDeleteTerminal: (terminalId: string) => void;
  onReorderTerminals?: (deckId: string, newOrder: TerminalSession[]) => void;
  terminalGroups?: TerminalGroup[];
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
}

// Group terminals by their groupId
function groupTerminals(
  terminals: TerminalSession[],
  groups: TerminalGroup[]
): {
  ungrouped: TerminalSession[];
  grouped: Map<TerminalGroup, TerminalSession[]>;
} {
  const ungrouped: TerminalSession[] = [];
  const grouped = new Map<TerminalGroup, TerminalSession[]>();

  // Initialize map with empty arrays for each group
  groups.forEach((group) => {
    grouped.set(group, []);
  });

  // Sort terminals into groups or ungrouped
  terminals.forEach((terminal) => {
    if (terminal.groupId) {
      const group = groups.find((g) => g.id === terminal.groupId);
      if (group) {
        grouped.get(group)?.push(terminal);
      } else {
        // Group not found, treat as ungrouped
        ungrouped.push(terminal);
      }
    } else {
      ungrouped.push(terminal);
    }
  });

  return { ungrouped, grouped };
}

// Calculate optimal grid for terminal count
function getOptimalGrid(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

export function TerminalPane({
  terminals,
  wsBase,
  deckId,
  onDeleteTerminal,
  onReorderTerminals,
  terminalGroups = [],
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup
}: TerminalPaneProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Create a flat list of terminals with their original indices for drag tracking
  const terminalsWithIndices = useMemo(
    () => terminals.map((terminal, index) => ({ terminal, index })),
    [terminals]
  );

  const { ungrouped, grouped } = useMemo(
    () => groupTerminals(terminals, terminalGroups),
    [terminals, terminalGroups]
  );

  // Sort groups: expanded first, then by name
  const sortedGroups = useMemo(
    () => [...grouped.entries()].sort(([, a], [, b]) => {
      const groupA = a[0];
      const groupB = b[0];
      // First sort by collapsed state (expanded first)
      if (groupA.collapsed !== groupB.collapsed) {
        return groupA.collapsed ? 1 : -1;
      }
      // Then by name
      return groupA.name.localeCompare(groupB.name);
    }),
    [grouped]
  );

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newTerminals = [...terminals];
      const [removed] = newTerminals.splice(draggedIndex, 1);
      newTerminals.splice(dragOverIndex, 0, removed);
      onReorderTerminals?.(deckId, newTerminals);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [deckId, draggedIndex, dragOverIndex, terminals, onReorderTerminals]);

  function renderTerminalGrid(
    terminals: TerminalSession[],
    startIndex: number
  ) {
    const { cols, rows } = getOptimalGrid(terminals.length);

    return (
      <div
        className="terminal-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {terminals.map((terminal, i) => {
          const globalIndex = startIndex + i;
          return (
            <DraggableTerminal
              key={terminal.id}
              session={terminal}
              wsUrl={`${wsBase}/api/terminals/${terminal.id}`}
              onDelete={() => onDeleteTerminal(terminal.id)}
              index={globalIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              isDragging={draggedIndex === globalIndex}
              isDragOver={dragOverIndex === globalIndex}
            />
          );
        })}
      </div>
    );
  }

  return (
    <section className="terminal-pane">
      {terminals.length === 0 ? (
        <div className="terminal-empty">
          <span className="terminal-empty-text">ターミナルを追加</span>
        </div>
      ) : (
        <div className="terminal-container">
          {/* Ungrouped terminals */}
          {ungrouped.length > 0 && (
            <div className="terminal-section">
              {renderTerminalGrid(ungrouped, 0)}
            </div>
          )}

          {/* Grouped terminals */}
          {sortedGroups.map(([group, groupTerminals]) =>
            groupTerminals.length > 0 ? (
              <div
                key={group.id}
                className="terminal-section terminal-group-section"
                style={{ borderColor: group.collapsed ? group.color : undefined }}
              >
                <TerminalGroupHeader
                  group={group}
                  terminalCount={groupTerminals.length}
                  onToggleCollapsed={() => onToggleGroupCollapsed?.(group.id)}
                  onCreateTerminal={onCreateTerminal}
                  onDeleteGroup={() => onDeleteGroup?.(group.id)}
                  onRenameGroup={() => onRenameGroup?.(group.id)}
                />
                {!group.collapsed && renderTerminalGrid(
                  groupTerminals,
                  terminals.findIndex(t => t.id === groupTerminals[0].id)
                )}
              </div>
            ) : null
          )}
        </div>
      )}
    </section>
  );
}
