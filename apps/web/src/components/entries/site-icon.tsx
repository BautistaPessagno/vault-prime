"use client";

import { useMemo, useState } from "react";

type SiteIconProps = {
  url: string | null | undefined;
  name: string;
  size?: number;
};

const PALETTE = [
  "#00b8c4",
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function deriveHost(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function initial(name: string, host: string | null): string {
  const source = name.trim() || host || "?";
  return source.charAt(0).toUpperCase();
}

export default function SiteIcon({ url, name, size = 40 }: SiteIconProps) {
  const host = useMemo(() => deriveHost(url), [url]);
  const [failed, setFailed] = useState(false);
  const [prevHost, setPrevHost] = useState<string | null>(host);
  if (prevHost !== host) {
    setPrevHost(host);
    setFailed(false);
  }

  const bg = useMemo(() => {
    const seed = host ?? name ?? "";
    return PALETTE[hashString(seed) % PALETTE.length];
  }, [host, name]);

  const letter = initial(name, host);
  const showImage = host && !failed;
  const iconSize = size - 8;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={`/api/icon?domain=${encodeURIComponent(host)}`}
          alt=""
          width={iconSize}
          height={iconSize}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-auto w-auto object-contain"
          style={{ maxWidth: iconSize, maxHeight: iconSize }}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
          style={{ backgroundColor: bg }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}
