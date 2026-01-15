import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

type VerifyEmailTemplateProps = {
  verifyUrl: string;
  code: string;
};

export function VerifyEmailTemplate({ verifyUrl, code }: VerifyEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>Your verification code: {code}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brand}>
            <Text style={styles.brandText}>Vault Prime</Text>
          </Section>

          <Heading style={styles.h1}>Verify your email address</Heading>
          <Text style={styles.p}>
            Enter this code to verify your email and activate your account:
          </Text>

          <Section style={styles.codeWrap}>
            <Text style={styles.code}>{code}</Text>
          </Section>

          <Text style={styles.pMuted}>
            Or click here to go to the verification page:
          </Text>
          <Section style={styles.ctaWrap}>
            <Button href={verifyUrl} style={styles.button}>
              Go to verification page
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            This code expires in 15 minutes. If you didn't request this, you can
            safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#0b132b",
    margin: 0,
    padding: "32px 0",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  },
  container: {
    backgroundColor: "#111a33",
    borderRadius: 18,
    margin: "0 auto",
    padding: "28px 28px 22px",
    maxWidth: 520,
  },
  brand: {
    marginBottom: 14,
  },
  brandText: {
    color: "#00f0ff",
    fontWeight: 700,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    fontSize: 12,
    margin: 0,
  },
  h1: {
    color: "#f8f8ff",
    fontSize: 28,
    margin: "6px 0 10px",
    lineHeight: "1.2",
  },
  p: {
    color: "#b3c0d8",
    fontSize: 15,
    lineHeight: "1.6",
    margin: "0 0 18px",
  },
  codeWrap: {
    backgroundColor: "#0b132b",
    borderRadius: 12,
    padding: "20px",
    margin: "20px 0 24px",
    textAlign: "center",
  },
  code: {
    color: "#00f0ff",
    fontSize: 42,
    fontWeight: 700,
    letterSpacing: "0.2em",
    margin: 0,
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
  },
  ctaWrap: {
    margin: "12px 0 16px",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#1e2d4a",
    borderRadius: 999,
    color: "#b3c0d8",
    display: "inline-block",
    fontSize: 13,
    fontWeight: 600,
    padding: "10px 16px",
    textDecoration: "none",
  },
  pMuted: {
    color: "#b3c0d8",
    fontSize: 13,
    lineHeight: "1.6",
    margin: "10px 0 6px",
  },
  linkText: {
    margin: 0,
    wordBreak: "break-all",
  },
  link: {
    color: "#00f0ff",
    fontSize: 13,
    textDecoration: "underline",
  },
  hr: {
    borderColor: "#24304a",
    margin: "18px 0 14px",
  },
  footer: {
    color: "#b3c0d8",
    fontSize: 12,
    lineHeight: "1.6",
    margin: 0,
  },
};

