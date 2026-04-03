import type { Category, MonthlyCategoryTotal } from "./app-types";
import { HomeOverview } from "./HomeOverview";
import { Money } from "./Money";

type HomeScreenProps = {
  categories: Category[];
  selectedCategoryId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCategory: (category: Category) => void;
  onOpenAdd: () => void;
  onOpenPlan: () => void;
  totalAssigned: number;
  totalSpent: number;
  assignedByCategory: MonthlyCategoryTotal[];
  spentByCategory: MonthlyCategoryTotal[];
};

export function HomeScreen({
  categories,
  selectedCategoryId,
  search,
  onSearchChange,
  onSelectCategory,
  onOpenAdd,
  onOpenPlan,
  totalAssigned,
  totalSpent,
  assignedByCategory,
  spentByCategory,
}: HomeScreenProps) {
  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">
      <header style={{ marginBottom: 20, animation: "fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, lineHeight: 1, color: "var(--text)" }}>
            Home
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            All your Notion categories in one place.
          </p>
        </div>
      </header>

      <div style={{ display: "grid", gap: 18 }}>
        <HomeOverview
          categories={categories}
          onOpenPlan={onOpenPlan}
          totalAssigned={totalAssigned}
          totalSpent={totalSpent}
          assignedByCategory={assignedByCategory}
          spentByCategory={spentByCategory}
        />

        <div
          style={{
            paddingBottom: 10,
            borderBottom: "1px solid color-mix(in srgb, var(--border2) 62%, transparent)",
            animation: "fadeUp 0.35s 0.04s ease both",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search categories"
            style={{
              width: "100%",
              background: "transparent",
              padding: 0,
              border: "none",
              borderRadius: 0,
              fontSize: 16,
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>

        <section style={{ display: "grid", gap: 0 }}>
          <div style={{ paddingBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)" }}>
                Categories
              </div>
              <p style={{ marginTop: 6, fontSize: 14, color: "var(--text2)" }}>Tap one to jump into the add sheet.</p>
            </div>
          </div>

          {categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat);
                onOpenAdd();
              }}
              style={{
                textAlign: "left",
                width: "100%",
                padding: "14px 0",
                background: "transparent",
                border: "none",
                borderTop: i === 0 ? "1px solid color-mix(in srgb, var(--border) 76%, transparent)" : "none",
                borderBottom: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                animation: `fadeUp 0.28s ${i * 0.03}s ease both`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: cat.id === selectedCategoryId ? "color-mix(in srgb, var(--accent-dim) 42%, white)" : "var(--surface2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                  transition: "background-color 0.2s ease",
                }}
              >
                {cat.icon ?? "#"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: cat.id === selectedCategoryId ? 700 : 650,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cat.name}
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
                  {(cat.type[0] ?? "Category").toUpperCase()} · Planned <Money value={cat.planned ?? 0} />
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: (cat.available ?? 0) >= 0 ? "var(--success)" : "var(--danger)",
                    fontWeight: cat.id === selectedCategoryId ? 700 : 500,
                  }}
                >
                  {(cat.available ?? 0) > 0 ? "+" : ""}
                  <Money value={cat.available ?? 0} />
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>available</div>
              </div>
            </button>
          ))}

          {categories.length === 0 && (
            <div style={{ padding: "18px 0", color: "var(--muted)", fontSize: 14 }}>
              No categories match that search.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
