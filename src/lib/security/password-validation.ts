import zxcvbn from "zxcvbn";

const MIN_PASSWORD_LENGTH = 12;
const MIN_ZXCVBN_SCORE = 3; // 0-4 scale, 3 = "strong"

interface PasswordValidationResult {
  valid: boolean;
  score: number;
  errors: string[];
  feedback: {
    warning: string;
    suggestions: string[];
  };
}

export function validatePassword(
  password: string,
  userInputs: string[] = []
): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  // Run zxcvbn analysis
  const result = zxcvbn(password, userInputs);

  // Check strength score
  if (result.score < MIN_ZXCVBN_SCORE) {
    errors.push("Password is not strong enough");
  }

  return {
    valid: errors.length === 0,
    score: result.score,
    errors,
    feedback: {
      warning: result.feedback.warning || "",
      suggestions: result.feedback.suggestions || [],
    },
  };
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return "Very Weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Strong";
    case 4:
      return "Very Strong";
    default:
      return "Unknown";
  }
}
