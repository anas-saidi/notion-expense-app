"use client";
import { useEffect, useState } from "react";
import type { BudgetScope } from "./app-types";
export type WorkRates = Partial<Record<BudgetScope, number>>;
export type PayFrequency = "monthly" | "weekly" | "yearly";
export type PayInput = { pay: string; hours: string; frequency: PayFrequency };
export type WorkConfig = { rate: number; method: "salary" | "hourly"; people?: PayInput[] };
const CONFIG_KEY = "finance-work-income-v2";
export function calculateWorkRate(people: PayInput[]): number | null {
  if (!people.length) return null;
  let annualPay = 0, annualHours = 0;
  for (const person of people) {
    const pay = Number(person.pay), hours = Number(person.hours);
    if (!person.pay.trim() || !person.hours.trim() || !Number.isFinite(pay) || !Number.isFinite(hours) || pay <= 0 || hours <= 0 || hours > 168 || !["monthly", "weekly", "yearly"].includes(person.frequency)) return null;
    annualPay += pay * (person.frequency === "monthly" ? 12 : person.frequency === "weekly" ? 52 : 1);
    annualHours += hours * 52;
  }
  const rate = annualPay / annualHours;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
export function readWorkConfig(scope: BudgetScope): WorkConfig | undefined {
  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}")[scope];
    if (config && Number.isFinite(config.rate) && config.rate > 0 && ["salary", "hourly"].includes(config.method)) {
      if (config.method === "salary" && (!Array.isArray(config.people) || config.people.length !== (scope === "joint" ? 2 : 1) || config.people.some((person: PayInput) => !person || typeof person.pay !== "string" || typeof person.hours !== "string") || calculateWorkRate(config.people) === null)) return { rate: config.rate, method: "hourly" };
      return config;
    }
  } catch { /* Legacy rates remain usable. */ }
  const rate = readLegacyRates()[scope];
  return rate ? { rate, method: "hourly" } : undefined;
}
export function saveWorkConfig(scope: BudgetScope, config: WorkConfig | null) {
  let configs: Partial<Record<BudgetScope, WorkConfig>> = {};
  try { configs = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"); } catch { /* Recover corrupt preferences. */ }
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) configs = {};
  if (config) configs[scope] = config; else delete configs[scope];
  // Clear the legacy value first so removing a configured rate cannot resurrect it.
  const legacy = readLegacyRates(); delete legacy[scope];
  localStorage.setItem(KEY, JSON.stringify(legacy));
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configs));
  window.dispatchEvent(new Event("work-rates-changed"));
}
const KEY = "finance-work-rates-v1";
function readLegacyRates(): WorkRates {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return Object.fromEntries((["joint", "anas", "salma"] as const).filter(scope => typeof value?.[scope] === "number" && Number.isFinite(value[scope]) && value[scope] > 0).map(scope => [scope, value[scope]]));
  } catch { return {}; }
}
export function readWorkRates(): WorkRates {
  return Object.fromEntries((["joint", "anas", "salma"] as const).flatMap(scope => {
    const config = readWorkConfig(scope);
    return config ? [[scope, config.rate]] : [];
  }));
}
export function useWorkRates() {
  const [rates, setRates] = useState<WorkRates>({});
  useEffect(() => {
    const update = () => setRates(readWorkRates());
    update(); window.addEventListener("work-rates-changed", update); window.addEventListener("storage", update);
    return () => { window.removeEventListener("work-rates-changed", update); window.removeEventListener("storage", update); };
  }, []);
  return rates;
}
export function saveWorkRate(scope: BudgetScope, rate: number | null) {
  if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) throw new Error("Enter a positive hourly rate.");
  saveWorkConfig(scope, rate === null ? null : { rate, method: "hourly" });
}
export function workTime(amount: number, rate: number) {
  const hours = Math.max(0, amount) / rate;
  if (hours > 0 && hours < 1) return "Less than 1 hour";
  const rounded = Math.round(hours);
  return `${rounded.toLocaleString()} ${rounded === 1 ? "hour" : "hours"}`;
}

export function hasMeaningfulWorkTime(amount: number, rate: number | undefined): boolean {
  return Number.isFinite(amount) && amount > 0 && rate !== undefined && Number.isFinite(rate) && rate > 0 && amount / rate >= 1;
}
