/** Languages with first party Cursorless tree-sitter support */
export const supportedLanguageIds = [
  "c",
  "clojure",
  "cpp",
  "css",
  "csharp",
  "go",
  "html",
  "java",
  "javascript",
  "javascriptreact",
  "json",
  "jsonc",
  "kotlin",
  "latex",
  "markdown",
  "php",
  "python",
  "ruby",
  "scala",
  "scss",
  "shellscript",
  "rust",
  "talon",
  "typescript",
  "typescriptreact",
  "xml",
] as const;

/**
 * Other language IDs that we might reference (e.g., for token customization)
 * but don't have full tree-sitter support for yet.
 */
export const otherLanguageIds = [] as const;

export const allLanguageIds = [...supportedLanguageIds, ...otherLanguageIds];

export type SupportedLanguageId = typeof supportedLanguageIds[number];
export type LanguageId = typeof allLanguageIds[number];
