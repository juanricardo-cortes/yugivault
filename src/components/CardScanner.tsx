"use client";

import { useState, useRef, useEffect } from "react";
import { cropCardBottom, extractSetNumber, terminateWorker } from "@/lib/ocr";
import type { OcrResult } from "@/lib/ocr";

interface CardScannerProps {
  onSetNumberFound: (setNumber: string) => void;
}

export default function CardScanner({ onSetNumberFound }: CardScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [editedNumber, setEditedNumber] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => terminateWorker();
  }, []);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreview(url);
    setResult(null);
    setScanning(true);
    setProgress(0);
    setLoading(true);

    const img = new Image();
    img.onload = async () => {
      try {
        const cropped = cropCardBottom(img);
        const ocrResult = await extractSetNumber(cropped, setProgress);
        setResult(ocrResult);
        setEditedNumber(ocrResult.setNumber || "");
      } catch {
        setResult({ setNumber: null, confidence: 0, rawText: "OCR failed" });
      } finally {
        setScanning(false);
        setLoading(false);
      }
    };
    img.src = url;

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleConfirm = () => {
    if (editedNumber.trim()) {
      onSetNumberFound(editedNumber.trim().toUpperCase());
      setPreview(null);
      setResult(null);
      setEditedNumber("");
    }
  };

  const handleReset = () => {
    setPreview(null);
    setResult(null);
    setEditedNumber("");
    setScanning(false);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {!preview ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 px-4 py-6 text-sm text-slate-400 hover:border-purple-500/50 hover:text-purple-300 transition-colors"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Scan Card with Camera
        </button>
      ) : (
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden">
            <img
              src={preview}
              alt="Captured card"
              className="w-full max-h-48 object-contain bg-black/20"
            />
            <button
              onClick={handleReset}
              className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Progress */}
          {scanning && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{loading && progress === 0 ? "Loading OCR engine..." : "Scanning..."}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Result */}
          {result && !scanning && (
            <div className="space-y-2">
              {result.setNumber ? (
                <>
                  <p className="text-xs text-green-400">Set number detected:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedNumber}
                      onChange={(e) => setEditedNumber(e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleConfirm}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
                    >
                      Search
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-yellow-400">
                    Could not detect set number. Enter it manually:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedNumber}
                      onChange={(e) => setEditedNumber(e.target.value)}
                      placeholder="e.g. ROTD-JP001"
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono uppercase placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleConfirm}
                      disabled={!editedNumber.trim()}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      Search
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Retake photo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
