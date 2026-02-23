import React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Button,
  Hr,
} from "@react-email/components";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://www.riskmate.dev";

export interface EmailLayoutProps {
  title: string;
  intro: string;
  children: React.ReactNode;
  ctaLabel?: string;
  ctaUrl?: string;
  managePreferencesUrl?: string;
}

export function EmailLayout({
  title,
  intro,
  children,
  ctaLabel,
  ctaUrl,
  managePreferencesUrl,
}: EmailLayoutProps) {
  const preferencesUrl =
    managePreferencesUrl ?? `${FRONTEND_URL}/settings/notifications`;

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={headerTextStyle}>RiskMate</Text>
          </Section>
          <Section style={contentStyle}>
            <Text style={h1Style}>{title}</Text>
            <Text style={introStyle}>{intro}</Text>
            {children}
            {ctaLabel && ctaUrl && (
              <Button href={ctaUrl} style={buttonStyle}>
                {ctaLabel}
              </Button>
            )}
          </Section>
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Manage email preferences:{" "}
              <Link href={preferencesUrl} style={linkStyle}>
                Notification settings
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f3f7fb",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  color: "#1f2937",
  padding: "24px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "#007aff",
  padding: "16px 20px",
};

const headerTextStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const contentStyle: React.CSSProperties = {
  padding: "24px",
};

const h1Style: React.CSSProperties = {
  fontSize: "22px",
  lineHeight: 1.3,
  margin: "0 0 12px",
  color: "#111827",
};

const introStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "15px",
  lineHeight: 1.6,
  color: "#374151",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#007aff",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 600,
  padding: "12px 16px",
  borderRadius: "8px",
  marginTop: "24px",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
};

const footerStyle: React.CSSProperties = {
  padding: "16px 24px",
};

const footerTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: 0,
};

const linkStyle: React.CSSProperties = {
  color: "#007aff",
  textDecoration: "none",
};
