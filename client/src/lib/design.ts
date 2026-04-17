// Mirror of the warm palette so charts can use named tokens.
export const palette = {
  parchment: "#f5f4ed",
  ivory: "#faf9f5",
  sand: "#e8e6dc",
  nearblack: "#141413",
  darksurface: "#30302e",
  terracotta: "#c96442",
  coral: "#d97757",
  charcoal: "#4d4c48",
  olive: "#5e5d59",
  stone: "#87867f",
  darkwarm: "#3d3d3a",
  silver: "#b0aea5",
  bordercream: "#f0eee6",
  borderwarm: "#e8e6dc",
  ringwarm: "#d1cfc5",
};

// Series colors for multi-line charts. Warm-only, max 8 distinct providers.
export const seriesColors = [
  "#c96442", // terracotta
  "#3d3d3a", // dark warm
  "#5e5d59", // olive
  "#d97757", // coral
  "#87867f", // stone
  "#4d4c48", // charcoal
  "#b53333", // crimson (use sparingly, but warm)
  "#b0aea5", // silver
];

export function colorFor(index: number): string {
  return seriesColors[index % seriesColors.length];
}
