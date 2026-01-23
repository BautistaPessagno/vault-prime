"use client";

type NoticeBannerProps = {
  notice: string;
  isError: boolean;
};

export default function NoticeBanner({ notice, isError }: NoticeBannerProps) {
  if (!notice) return null;

  return (
    <div
      className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border bg-[color:var(--card)] px-4 py-3 text-sm shadow-sm animate-[fadeIn_0.15s_ease-out] ${
        isError
          ? "border-[color:var(--danger)] text-[color:var(--danger)]"
          : "border-[color:var(--success)] text-[color:var(--success)]"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isError ? "bg-[color:var(--danger)]" : "bg-[color:var(--success)]"
        }`}
      ></span>
      <span>{notice}</span>
    </div>
  );
}
