import type { Worker } from "tesseract.js";

let worker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (worker) return Promise.resolve(worker);
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(async ({ createWorker }) => {
      worker = await createWorker("eng");
      return worker;
    });
  }
  return workerPromise;
}

// Call early to start downloading WASM + language data in background
export function preloadWorker() {
  getWorker();
}

export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    workerPromise = null;
  }
}

const SET_NUMBER_PATTERN = /([A-Z0-9]{2,5})-([A-Z]{2})(\d{3})/i;

function correctOcrErrors(match: RegExpMatchArray): string {
  const [, prefix, countryCode, digits] = match;

  // Country code: force alpha
  const fixedCountry = countryCode
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .toUpperCase();

  // Digits: force numeric
  const fixedDigits = digits
    .replace(/[oO]/g, "0")
    .replace(/[iIlL]/g, "1")
    .replace(/[sS]/g, "5");

  return `${prefix.toUpperCase()}-${fixedCountry}${fixedDigits}`;
}

export function cropCardBottom(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Crop bottom 30% of the image
  const cropHeight = Math.floor(image.naturalHeight * 0.3);
  canvas.width = image.naturalWidth;
  canvas.height = cropHeight;

  ctx.drawImage(
    image,
    0,
    image.naturalHeight - cropHeight,
    image.naturalWidth,
    cropHeight,
    0,
    0,
    image.naturalWidth,
    cropHeight
  );

  return canvas;
}

export interface OcrResult {
  setNumber: string | null;
  confidence: number;
  rawText: string;
}

export async function extractSetNumber(
  image: HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const w = await getWorker();

  const result = await w.recognize(image, undefined, {
    progress: onProgress
      ? (p: { status: string; progress: number }) => {
          if (p.status === "recognizing text") {
            onProgress(p.progress);
          }
        }
      : undefined,
  } as Parameters<Worker["recognize"]>[2]);

  const rawText = result.data.text;
  const match = rawText.match(SET_NUMBER_PATTERN);

  if (match) {
    return {
      setNumber: correctOcrErrors(match),
      confidence: result.data.confidence,
      rawText,
    };
  }

  return { setNumber: null, confidence: 0, rawText };
}
