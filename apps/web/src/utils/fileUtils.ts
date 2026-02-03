/**
 * File and tree manipulation utilities
 */

import type { FileSystemEntry, FileTreeNode } from '../types';
import { getLanguageFromPath as sharedGetLanguageFromPath } from '@side-ide/shared/utils';

/**
 * Converts FileSystemEntry array to FileTreeNode array
 */
export function toTreeNodes(entries: FileSystemEntry[]): FileTreeNode[] {
  return entries.map((entry) => ({
    ...entry,
    expanded: false,
    loading: false,
    children: entry.type === 'dir' ? [] : undefined
  }));
}

/**
 * Determines the Monaco Editor language from a file path
 * Uses shared utility from @deck-ide/shared
 */
export function getLanguageFromPath(filePath: string): string {
  return sharedGetLanguageFromPath(filePath);
}

/**
 * Updates a tree node by path, applying the updater function
 */
export function updateTreeNode(
  nodes: FileTreeNode[],
  targetPath: string,
  updater: (node: FileTreeNode) => FileTreeNode
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return updater(node);
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeNode(node.children, targetPath, updater)
      };
    }
    return node;
  });
}
