export const DEBOUNCE_DELAY = 175;

export const TOKEN_MATCHER = /[a-zA-Z_][a-zA-Z_0-9]*|\-?((\d+(\.\d*)?)|(\.\d+))|[^\s\w]/g;

export const COLORS = [
  "default",
  "blue",
  "green",
  "red",
  "yellow",
  "mauve",
] as const;

export type SymbolColor = typeof COLORS[number];
