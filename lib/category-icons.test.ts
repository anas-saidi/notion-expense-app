import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_IMAGE_BY_NAME, categoryIconSource, DEFAULT_CATEGORY_IMAGE } from "./category-icons";

describe("category artwork", () => {
  it("distinguishes categories that previously shared the same emoji", () => {
    expect(categoryIconSource("🧾", "Car Expenses")).toBe("/category-icons/car.webp");
    expect(categoryIconSource("🧾", "Personal Saving")).toBe("/category-icons/piggy-bank.webp");
  });
  it("normalizes legacy spacing and punctuation in category names", () => {
    expect(categoryIconSource(null, " Furniture ")).toBe("/category-icons/sofa.webp");
    expect(categoryIconSource(null, "Charity ( hubby )")).toBe("/category-icons/food-donation.webp");
  });
  it("preserves explicit images and provides an image fallback for an unknown category", () => {
    expect(categoryIconSource("/category-icons/book.webp", "Shopping")).toBe("/category-icons/book.webp");
    expect(categoryIconSource("https://example.com/custom.png", "Shopping")).toBe("https://example.com/custom.png");
    expect(categoryIconSource("🦄", "Something new")).toBe(DEFAULT_CATEGORY_IMAGE);
    expect(categoryIconSource("javascript:alert(1)")).toBe(DEFAULT_CATEGORY_IMAGE);
  });
  it("ships an actual image for every curated mapping and its fallback", () => {
    for (const slug of Object.values(CATEGORY_IMAGE_BY_NAME)) expect(existsSync(join(process.cwd(), "public/category-icons", `${slug}.webp`)), slug).toBe(true);
    expect(existsSync(join(process.cwd(), "public", DEFAULT_CATEGORY_IMAGE))).toBe(true);
  });
});
