import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminUsersClient from "@/components/AdminUsersClient";

export const metadata = {
  title: "Admin · Usuarios | StyleFlix",
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");

  return <AdminUsersClient />;
}
