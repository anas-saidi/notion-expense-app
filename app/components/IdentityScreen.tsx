"use client";
import { ChevronRightIcon } from "./ui/icons";

type Props = {
  onSelect: (mode: "wife" | "husband") => void;
};

const IDENTITIES: { mode: "wife" | "husband"; name: string; role: string; accent: string; accentDim: string }[] = [
  {
    mode: "wife",
    name: "Salma",
    role: "Wife",
    accent: "var(--partner-wife)",
    accentDim: "color-mix(in srgb, var(--partner-wife) 10%, var(--surface))",
  },
  {
    mode: "husband",
    name: "Anas",
    role: "Husband",
    accent: "var(--partner-husband)",
    accentDim: "color-mix(in srgb, var(--partner-husband) 10%, var(--surface))",
  },
];

export function IdentityScreen({ onSelect }: Props) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px calc(40px + env(safe-area-inset-bottom, 0px))",
        background: "var(--bg)",
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 0.95,
            color: "var(--text)",
            marginBottom: 12,
          }}
        >
          Who are you?
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
          The app will remember your choice.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 340 }}>
        {IDENTITIES.map(({ mode, name, role, accent, accentDim }) => (
          <button
            key={mode}
            className="identity-card-btn"
            onClick={() => onSelect(mode)}
            aria-label={`Continue as ${name}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 20px",
              background: accentDim,
              border: `1.5px solid color-mix(in srgb, ${accent} 28%, transparent)`,
              borderRadius: 16,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: accent,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {name[0]}
            </span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1.1 }}>
                {name}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {role}
              </div>
            </div>
            <ChevronRightIcon strokeWidth={2.5} style={{ marginLeft: "auto", color: accent, opacity: 0.55, flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
