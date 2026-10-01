export const AVATAR_PALETTES = [
  // Pink / Purple / Blue
  [
    "#ed719e",
    "#9929bd",
    "#5e30eb",
    "#0061ff",
    "#fffedb",
  ],

  // Sunset
  [
    "#ff6b6b",
    "#ff8787",
    "#ffa94d",
    "#ffd43b",
    "#fff3bf",
  ],

  // Ocean
  [
    "#003566",
    "#0077b6",
    "#00b4d8",
    "#90e0ef",
    "#caf0f8",
  ],

  // Emerald
  [
    "#064e3b",
    "#047857",
    "#10b981",
    "#34d399",
    "#d1fae5",
  ],

  // Violet
  [
    "#3b0764",
    "#6d28d9",
    "#8b5cf6",
    "#c084fc",
    "#f3e8ff",
  ],

  // Fire
  [
    "#7f1d1d",
    "#dc2626",
    "#f97316",
    "#facc15",
    "#fef3c7",
  ],

  // Tropical
  [
    "#006d77",
    "#00a896",
    "#02c39a",
    "#90be6d",
    "#f9c74f",
  ],

  // Cyber
  [
    "#1e1b4b",
    "#4338ca",
    "#7c3aed",
    "#06b6d4",
    "#22d3ee",
  ],

  // Candy
  [
    "#be185d",
    "#db2777",
    "#ec4899",
    "#f472b6",
    "#fbcfe8",
  ],

  // Earth
  [
    "#3f2d20",
    "#795548",
    "#a1887f",
    "#d7ccc8",
    "#efebe9",
  ],

  // Midnight
  [
    "#020617",
    "#0f172a",
    "#1e293b",
    "#475569",
    "#94a3b8",
  ],

  // Aurora
  [
    "#312e81",
    "#4f46e5",
    "#06b6d4",
    "#14b8a6",
    "#a3e635",
  ],
] as const;

export function getAvatarColors(
  paletteIndex: number,
  reversed: boolean,
) {
  const palette =
    AVATAR_PALETTES[
      paletteIndex % AVATAR_PALETTES.length
    ];

  return reversed
    ? [...palette].reverse()
    : [...palette];
}