import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminSettingsClient from "@/components/AdminSettingsClient";

export const metadata = {
  title: "Admin · Ajustes | VeoTV",
};

export default async function AdminAjustesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/ajustes");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");
  return <AdminSettingsClient />;
}
