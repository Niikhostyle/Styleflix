import AdminShell from "@/components/AdminShell";
import AdminSecurityClient from "@/components/AdminSecurityClient";

export default function AdminSeguridadPage() {
  return (
    <AdminShell
      title="Seguridad"
      subtitle="Métricas en vivo, IPs activas, últimas conexiones, escaneos y bloqueos."
    >
      <AdminSecurityClient />
    </AdminShell>
  );
}
