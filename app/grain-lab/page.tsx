import { notFound } from "next/navigation";
import { GrainLab } from "../components/grain/GrainLab";

export const metadata = { title: "Grain lab" };

/** Dev-only study: grain glow behind the Home hero, not used by any production screen. */
export default function GrainLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <GrainLab />;
}
