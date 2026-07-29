import type { CSSProperties } from "react";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const notAllowed = searchParams.error === "not_allowed";

  return (
    <div style={container}>
      <div style={card}>
        <div style={eyebrow}>Expenses</div>
        <h1 style={title}>Sign in to continue</h1>
        <p style={subtitle}>
          This app is private to two people. Sign in with the Notion account
          you already use.
        </p>
        {notAllowed && (
          <p style={errorBanner}>Not an authorized account.</p>
        )}
        <a href="/api/auth/login" style={button}>
          Continue with Notion
        </a>
      </div>
    </div>
  );
}

const container: CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--bg)",
  paddingTop: "calc(24px + var(--safe-top))",
  paddingBottom: "calc(24px + var(--safe-bottom))",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "32px 24px",
  textAlign: "center",
  boxShadow: "var(--card-shadow)",
};

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 8,
};

const title: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 24,
  fontWeight: 700,
  color: "var(--text)",
  margin: "0 0 12px",
};

const subtitle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--text2)",
  margin: "0 0 24px",
  lineHeight: 1.5,
};

const errorBanner: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "var(--danger)",
  margin: "0 0 16px",
};

const button: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  width: "100%",
  background: "var(--action)",
  color: "var(--action-ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  borderRadius: 14,
};
