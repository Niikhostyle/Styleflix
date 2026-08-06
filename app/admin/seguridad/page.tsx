import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminShell from "@/components/AdminShell";
import AdminSecurityClient from "@/components/AdminSecurityClient";

export const metadata = {
  title: "Admin · Seguridad | VeoTV",
};

export default async function AdminSeguridadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/seguridad");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");

  return (
    <AdminShell
      title="Seguridad"
      subtitle="Métricas en vivo, IPs activas, registros del día, últimas conexiones y bloqueos."
    >
      <AdminSecurityClient />
    </AdminShell>
  );
}
