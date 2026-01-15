import { Resend } from "resend";
import { VerifyEmailTemplate } from "@/src/components/email/verify-email-template";

type SendVerificationEmailArgs = {
  to: string;
  verifyUrl: string;
  code: string;
};

export async function sendVerificationEmail({
  to,
  verifyUrl,
  code,
}: SendVerificationEmailArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "missing_resend_api_key" };
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? "Vault Prime <no-reply@vault-prime.com>";

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "Verify your email · Vault Prime",
      react: VerifyEmailTemplate({ verifyUrl, code }),
    });

    if (error) {
      return { ok: false, error: error.message || String(error) };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

