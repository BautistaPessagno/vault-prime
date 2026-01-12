import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Text,
} from "@react-email/components";
import * as React from "react";

interface EmailTemplateProps {
  firstName: string;
}

export function EmailTemplate({ firstName }: EmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ margin: "0 auto", padding: "20px" }}>
          <Heading style={{ color: "#333", fontSize: "24px" }}>
            Welcome, {firstName}!
          </Heading>
          <Text style={{ color: "#666", fontSize: "16px" }}>
            Thank you for joining us.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
