import { notFound } from "next/navigation";
import DueLab from "./DueLab";

export const metadata = { title: "Due lab" };

/** Dev-only playground for due bills on the derived-occurrence model. */
export default function DueLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DueLab />;
}
