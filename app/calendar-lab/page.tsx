import { notFound } from "next/navigation";
import { CalendarLab } from "../components/calendar/CalendarLab";

export const metadata = { title: "Calendar lab" };

/** Dev-only playground for the Calendar tab concept before it replaces Reflect. */
export default function CalendarLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CalendarLab />;
}
