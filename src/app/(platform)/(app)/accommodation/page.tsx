import { redirect } from "next/navigation";

export const metadata = { title: "Accommodation" };

export default function AccommodationIndexPage() {
  redirect("/accommodation/camps");
}
