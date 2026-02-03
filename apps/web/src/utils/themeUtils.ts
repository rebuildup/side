/**
 * Theme management utilities
 * Dark theme only - monochrome black theme
 */

export type ThemeMode = "dark";

/**
 * Gets the initial theme - always dark
 */
export function getInitialTheme(): ThemeMode {
  return "dark";
}
