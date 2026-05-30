"use client";

import { PDF_PREVIEW_SAMPLES, type PdfPreviewSampleId } from "@/lib/pdf/sample-data";
import { useCallback, useEffect, useState } from "react";

export default function PdfPreviewClient() {
  const [sample, setSample] = useState<PdfPreviewSampleId>("invoice");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPdf = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams({
      sample,
      t: String(refreshKey),
    });
    const url = `/api/dev/pdf-preview?${params.toString()}`;

    try {
      const res = await fetch(url);
      const type = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Preview failed (${res.status})`);
      }

      if (!type.includes("application/pdf")) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Server did not return a PDF.");
      }

      const blob = await res.blob();
      const nextUrl = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load PDF.");
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, [sample, refreshKey]);

  useEffect(() => {
    void loadPdf();
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadPdf]);

  const downloadName = `preview-${sample}.pdf`;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              PDF preview (dev)
            </h1>
            <p className="text-xs text-zinc-500">
              Fetches a fresh PDF each time — use Refresh after edits. PDF text uses
              Helvetica (Outfit breaks in Chrome&apos;s viewer).
            </p>
          </div>

          <label className="ml-auto flex items-center gap-2 text-sm text-zinc-700">
            Sample
            <select
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              value={sample}
              onChange={(e) => {
                setSample(e.target.value as PdfPreviewSampleId);
                setRefreshKey((k) => k + 1);
              }}
            >
              {PDF_PREVIEW_SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            disabled={loading}
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            {loading ? "Loading…" : "Refresh PDF"}
          </button>

          {blobUrl ? (
            <a
              href={blobUrl}
              download={downloadName}
              className="text-sm text-orange-600 hover:underline"
            >
              Download
            </a>
          ) : null}

          <a href="/" className="text-sm text-zinc-500 hover:underline">
            Billing dashboard
          </a>
        </div>

        {loadError ? (
          <p className="mx-auto mt-2 max-w-6xl text-sm text-red-600">{loadError}</p>
        ) : null}
      </header>

      <div
        className="mx-auto w-full max-w-6xl flex-1 bg-zinc-300"
        style={{ minHeight: "calc(100vh - 100px)" }}
      >
        {loading && !blobUrl ? (
          <p className="p-8 text-center text-sm text-zinc-600">Generating PDF…</p>
        ) : null}
        {blobUrl ? (
          <embed
            key={blobUrl}
            src={`${blobUrl}#toolbar=1&navpanes=0`}
            type="application/pdf"
            className="h-full w-full"
            style={{ minHeight: "calc(100vh - 100px)" }}
          />
        ) : null}
      </div>
    </div>
  );
}
