import type { Rgb } from "@/lib/types";

type Color = { red?: number; green?: number; blue?: number };

export function toRgb(color: Color | undefined | null): Rgb | null {
  if (!color) return null;
  return {
    red: color.red ?? 0,
    green: color.green ?? 0,
    blue: color.blue ?? 0,
  };
}

export function isGreenBackground(rgb: Rgb | null): boolean {
  if (!rgb) return false;
  return rgb.green > 0.65 && rgb.red > 0.4 && rgb.blue < 0.55;
}

export function isYellowBackground(rgb: Rgb | null): boolean {
  if (!rgb) return false;
  return rgb.red > 0.75 && rgb.green > 0.75 && rgb.blue < 0.5;
}

export function isBlueBackground(rgb: Rgb | null): boolean {
  if (!rgb) return false;
  return rgb.blue > 0.6 && rgb.green > 0.5 && rgb.red < 0.7;
}

/** Black class header rows (white text on black) */
export function isBlackBackground(rgb: Rgb | null): boolean {
  if (!rgb) return false;
  return rgb.red < 0.25 && rgb.green < 0.25 && rgb.blue < 0.25;
}
