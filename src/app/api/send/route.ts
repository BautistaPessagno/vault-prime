import { EmailTemplate } from "@/src/components/email/email-template";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const { data, error } = await resend.emails.send({
      from: "Acme <onboarding@resend.dev>",
      to: ["bpessagno@itba.edu.ar"],
      subject: "email succeded",
      react: EmailTemplate({ firstName: "John" }),
    });

    if (error) {
      console.error("Resend API error:", error);
      return Response.json(
        { error: error.message || String(error) },
        { status: 500 },
      );
    }

    return Response.json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
