"use client";

import type { ZXCVBNResult } from "zxcvbn";

interface PasswordStrengthMeterProps {
  strength: ZXCVBNResult;
  password: string;
  showRequirements?: boolean;
  minLength?: number;
  minScore?: number;
}

export default function PasswordStrengthMeter({
  strength,
  password,
  showRequirements = true,
  minLength = 12,
  minScore = 3,
}: PasswordStrengthMeterProps) {
  const score = strength.score;

  const strengthLabels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const strengthColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
  ];

  const label = strengthLabels[score];
  const color = strengthColors[score];
  const isLengthValid = password.length >= minLength;
  const isScoreValid = score >= minScore;

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex h-1.5 gap-1 overflow-hidden rounded-full bg-[color:var(--border)]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex-1 transition-all duration-300 ${
                  i <= score ? color : "bg-transparent"
                }`}
              />
            ))}
          </div>
        </div>
        <span className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {label}
        </span>
      </div>

      {/* Requirements */}
      {showRequirements && (
        <div className="space-y-1 text-xs">
          <div
            className={`flex items-center gap-1.5 ${
              isLengthValid
                ? "text-green-600 dark:text-green-400"
                : "text-[color:var(--muted-foreground)]"
            }`}
          >
            {isLengthValid ? (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
              </svg>
            )}
            <span>At least {minLength} characters</span>
          </div>
          <div
            className={`flex items-center gap-1.5 ${
              isScoreValid
                ? "text-green-600 dark:text-green-400"
                : "text-[color:var(--muted-foreground)]"
            }`}
          >
            {isScoreValid ? (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
              </svg>
            )}
            <span>Strong password (score {minScore}+)</span>
          </div>
        </div>
      )}

      {/* Feedback from zxcvbn */}
      {(strength.feedback.warning || strength.feedback.suggestions.length > 0) && (
        <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          {strength.feedback.warning && (
            <p className="font-medium">{strength.feedback.warning}</p>
          )}
          {strength.feedback.suggestions.length > 0 && (
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {strength.feedback.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
