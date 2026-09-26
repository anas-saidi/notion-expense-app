import { notFound } from "next/navigation";
import { MascotLab } from "../components/mascot/MascotLab";

export const metadata = { title: "Mascot lab" };

/** Dev-only playground for tuning the mascot before it ships anywhere in the app. */
export default function MascotLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MascotLab />;
}
