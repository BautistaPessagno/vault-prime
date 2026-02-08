import { z } from "zod";

export const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .transform((v) => v.trim().toLowerCase()),
    password: z.string().min(12, "Password must be at least 12 characters"),
    passwordConfirmation: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const entrySchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  username: z.string().max(255, "Username is too long").default(""),
  password: z.string().min(1, "Password is required").max(1024, "Password is too long"),
  url: z
    .string()
    .max(2048, "URL is too long")
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const url = new URL(v);
          return ["http:", "https:"].includes(url.protocol);
        } catch {
          return false;
        }
      },
      { message: "Invalid URL format. Only http and https URLs are allowed." }
    )
    .default(""),
});

export type EntryInput = z.infer<typeof entrySchema>;
