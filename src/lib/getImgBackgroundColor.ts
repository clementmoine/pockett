import chroma from "chroma-js";
import ColorThief from "colorthief";

export const getImgBackgroundColor = async (
  base64: string,
): Promise<string> => {
  const img = await loadImage(base64);
  const hasAlpha = checkTransparency(img);
  const rgb = getDominantColor(img);
  return chooseBackgroundColor(rgb, hasAlpha);
};

// charge l'image depuis un base64
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => resolve(img);
  });

// détection de transparence via canal alpha
const checkTransparency = (img: HTMLImageElement): boolean => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true; // marge de tolérance
  }
  return false;
};

// couleur dominante via ColorThief
const getDominantColor = (img: HTMLImageElement): [number, number, number] => {
  const colorThief = new ColorThief();
  return colorThief.getColor(img) as [number, number, number];
};

// choix final du fond
const chooseBackgroundColor = (
  rgb: [number, number, number],
  transparent: boolean,
): string => {
  const color = chroma(rgb);
  if (transparent) {
    // choisir entre noir/blanc ou ajuster un peu le contraste
    return chroma.contrast(color, "white") >= 4.5 ? "#ffffff" : "#111111";
  } else {
    return color.hex();
  }
};
