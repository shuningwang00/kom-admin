import { Font } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

let outfitRegistered = false;

/**
 * Custom Outfit often renders blank in Chrome/Safari PDF viewers when embedded
 * via react-pdf. Built-in Helvetica always displays. Set PDF_USE_OUTFIT=1 to try Outfit.
 */
export const PDF_FONT_FAMILY =
  process.env.PDF_USE_OUTFIT === "1" ? "Outfit" : "Helvetica";

function registerOutfitFonts(): void {
  if (outfitRegistered) return;

  const regular = path.join(FONT_DIR, "Outfit-Regular.ttf");
  const bold = path.join(FONT_DIR, "Outfit-Bold.ttf");
  if (!fs.existsSync(regular) || !fs.existsSync(bold)) {
    throw new Error("Missing public/fonts/Outfit-*.ttf");
  }

  Font.register({
    family: "Outfit",
    fonts: [
      { src: regular, fontWeight: "normal" },
      { src: bold, fontWeight: "bold" },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);
  outfitRegistered = true;
}

if (PDF_FONT_FAMILY === "Outfit") {
  registerOutfitFonts();
}
