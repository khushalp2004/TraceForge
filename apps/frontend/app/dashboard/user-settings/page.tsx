import { redirect } from "next/navigation";

export default function LegacyUserSettingsPage() {
  redirect("/dashboard/account/details");
}
