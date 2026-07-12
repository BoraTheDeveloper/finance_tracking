export const LIGHT = {
  page: "#f5f6f8",
  surface: "#ffffff",
  surface2: "#f0f1f6",
  text: "#1a1b22",
  muted: "#71727e",
  faint: "#a4a5af",
  line: "#ecedf1",
  primary: "#4f46e5",
  primaryWash: "#ecebfd",
  ringTrack: "#e3e5ee",
  green: "#1f8a5b",
  amber: "#c8820a",
  red: "#d84c3f",
  heat: {
    savedHigh: "#1f8a5b",
    saved: "#57b98a",
    near: "#a9dcc4",
    over: "#e0a63a",
    overHigh: "#e0603a",
  },
};

export const DARK = {
  page: "#0f1117",
  surface: "#191b22",
  surface2: "#20222c",
  text: "#eceef4",
  muted: "#9498a6",
  faint: "#5f616d",
  line: "#262932",
  primary: "#8b83ff",
  primaryWash: "#26243f",
  ringTrack: "#2b2e3a",
  green: "#3fbc86",
  amber: "#e0a63a",
  red: "#f0685c",
  heat: {
    savedHigh: "#3fbc86",
    saved: "#2f9f72",
    near: "#2f6f56",
    over: "#e0a63a",
    overHigh: "#f0685c",
  },
};

export type Theme = typeof LIGHT;
