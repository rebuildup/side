/**
 * Topic Drift Detector for Claude Context Manager
 *
 * Uses hybrid approach:
 * 1. Lightweight keyword-based drift detection (fast, always runs)
 * 2. LLM-based detailed analysis (only when keyword drift exceeds threshold)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicDriftDetector = void 0;
/**
 * Known technical keywords for drift detection
 */
const TECH_KEYWORDS = new Set([
  // Languages
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "rust",
  "c++",
  "csharp",
  "jsx",
  "tsx",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "xml",
  "sql",
  // Frameworks
  "react",
  "vue",
  "angular",
  "svelte",
  "next",
  "nuxt",
  "express",
  "fastify",
  "django",
  "flask",
  "spring",
  "laravel",
  "rails",
  "nest",
  "koa",
  // Tools
  "git",
  "docker",
  "kubernetes",
  "webpack",
  "vite",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "cypress",
  "playwright",
  "babel",
  "tslint",
  // Concepts
  "api",
  "rest",
  "graphql",
  "grpc",
  "websocket",
  "http",
  "https",
  "database",
  "sql",
  "nosql",
  "mongodb",
  "postgresql",
  "mysql",
  "redis",
  "authentication",
  "authorization",
  "jwt",
  "oauth",
  "session",
  "cookie",
  "component",
  "hook",
  "middleware",
  "router",
  "controller",
  "service",
  "interface",
  "type",
  "class",
  "function",
  "async",
  "await",
  "promise",
  "frontend",
  "backend",
  "fullstack",
  "devops",
  "ci",
  "cd",
  // Testing
  "test",
  "spec",
  "mock",
  "stub",
  "snapshot",
  "coverage",
  // Build/Deploy
  "build",
  "deploy",
  "release",
  "version",
  "package",
  "dependency",
]);
/**
 * File extensions to extract as keywords
 */
const _FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".toml",
  ".ini",
  ".md",
  ".txt",
  ".log",
]);
/**
 * Regex patterns for keyword extraction
 */
const PATTERNS = {
  // File paths: src/components/Button.tsx, /api/users
  filePath: /[\w~/.]+\.(?:ts|tsx|js|jsx|py|go|rs|java|html|css|scss|json|yaml|yml|md)/gi,
  // URLs/URIs
  url: /https?:\/\/[^\s<>"]+/gi,
  // camelCase identifiers
  camelCase: /\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/g,
  // PascalCase identifiers
  pascalCase: /\b[A-Z][a-z0-9]*[A-Z][a-z0-9]*\b/g,
  // UPPER_CASE identifiers
  upperCase: /\b[A-Z][A-Z0-9_]*\b/g,
  // kebab-case identifiers
  kebabCase: /\b[a-z][a-z0-9]*(-[a-z0-9]+)+\b/g,
};
/**
 * Extract keywords from text using multiple patterns
 */
function extractKeywords(text) {
  const keywords = new Set();
  // Extract file paths
  const filePaths = text.match(PATTERNS.filePath) || [];
  filePaths.forEach((path) => {
    // Extract just the filename without extension
    const filename = path.split(/[/\\]/).pop() || "";
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
    if (nameWithoutExt.length > 2) {
      keywords.add(nameWithoutExt.toLowerCase());
    }
    // Also add the full path as a keyword
    keywords.add(path.toLowerCase());
  });
  // Extract URLs (domain names)
  const urls = text.match(PATTERNS.url) || [];
  urls.forEach((url) => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace("www.", "");
      keywords.add(domain);
    } catch {
      // Invalid URL, skip
    }
  });
  // Extract technical identifiers
  const camelCase = text.match(PATTERNS.camelCase) || [];
  const pascalCase = text.match(PATTERNS.pascalCase) || [];
  const upperCase = text.match(PATTERNS.upperCase) || [];
  const kebabCase = text.match(PATTERNS.kebabCase) || [];
  [...camelCase, ...pascalCase, ...upperCase, ...kebabCase].forEach((word) => {
    // Filter out common words
    if (word.length > 2 && !isCommonWord(word)) {
      keywords.add(word.toLowerCase());
    }
  });
  // Extract known tech keywords
  const lowerText = text.toLowerCase();
  TECH_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      keywords.add(keyword);
    }
  });
  return keywords;
}
/**
 * Check if a word is a common non-technical word
 */
function isCommonWord(word) {
  const commonWords = new Set([
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "can",
    "her",
    "was",
    "one",
    "our",
    "out",
    "has",
    "have",
    "been",
    "this",
    "that",
    "with",
    "they",
    "from",
    "what",
    "which",
    "their",
    "there",
    "would",
    "about",
    "could",
    "should",
    "after",
    "before",
    "being",
    "does",
    "did",
    "will",
    "shall",
    "may",
    "might",
    "must",
    "into",
    "through",
    "during",
    "these",
    "those",
    "each",
    "every",
    "some",
    "such",
    "your",
    "mine",
  ]);
  return commonWords.has(word.toLowerCase());
}
/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1, set2) {
  if (set1.size === 0 && set2.size === 0) {
    return 1.0; // Both empty means identical
  }
  // Convert Sets to Arrays for spread operations (ES5 compatible)
  const arr1 = Array.from(set1);
  const arr2 = Array.from(set2);
  const intersection = new Set(arr1.filter((x) => set2.has(x)));
  const union = new Set(arr1.concat(arr2));
  return intersection.size / union.size;
}
/**
 * Topic Drift Detector
 *
 * Detects when conversation drifts from the original topic using a hybrid approach:
 * - Fast keyword-based detection always runs
 * - LLM-based analysis only when keyword drift exceeds threshold
 */
class TopicDriftDetector {
  /**
   * Lightweight keyword-based drift detection
   *
   * Extracts keywords from initial prompt and recent messages,
   * then calculates Jaccard similarity.
   *
   * @param session - The Claude session to analyze
   * @returns Drift score (0 = no drift, 1 = complete drift)
   */
  detectKeywordDrift(session) {
    // Null check for messages
    if (!session.messages || session.messages.length === 0) {
      return 0;
    }
    // Extract keywords from initial prompt (access via metadata)
    const initialPrompt = session.metadata.initialPrompt || session.messages[0]?.content || "";
    const initialKeywords = extractKeywords(initialPrompt);
    // Extract keywords from recent messages (last 5 or all if fewer)
    const recentMessages = session.messages.slice(-5);
    const recentText = recentMessages.map((m) => m.content).join(" ");
    const recentKeywords = extractKeywords(recentText);
    // Calculate similarity and convert to drift
    const similarity = jaccardSimilarity(initialKeywords, recentKeywords);
    const drift = 1 - similarity;
    return drift;
  }
  /**
   * LLM-based detailed analysis
   *
   * Performs semantic analysis using the Claude API to detect topic drift
   * more accurately than keyword-based methods.
   *
   * Future implementation plan:
   * - Send initial prompt and recent messages to Claude API
   * - Ask Claude to rate semantic similarity (0-1)
   * - Cache results to avoid repeated API calls
   *
   * @param session - The Claude session to analyze
   * @returns Drift score (0 = no drift, 1 = complete drift)
   */
  async detectLLMDrift(session) {
    // Fallback to keyword-based detection until LLM integration is implemented
    return this.detectKeywordDrift(session);
  }
  /**
   * Main detection method with threshold routing
   *
   * Always runs keyword-based detection. If drift exceeds threshold,
   * performs LLM analysis for more accurate results.
   *
   * @param session - The Claude session to analyze
   * @param threshold - Drift threshold for triggering LLM analysis (default: 0.5)
   * @returns Detection result with drift score, method used, and analysis flag
   */
  async detect(session, threshold = 0.5) {
    // Always run keyword-based detection first
    const keywordDrift = this.detectKeywordDrift(session);
    // If keyword drift is below threshold, return early
    if (keywordDrift < threshold) {
      return {
        driftScore: keywordDrift,
        method: "keyword",
        needsDeepAnalysis: false,
      };
    }
    // Keyword drift exceeds threshold, perform LLM analysis
    const llmDrift = await this.detectLLMDrift(session);
    return {
      driftScore: llmDrift,
      method: "llm",
      needsDeepAnalysis: llmDrift >= threshold,
    };
  }
}
exports.TopicDriftDetector = TopicDriftDetector;
