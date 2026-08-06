import AdminShell from "@/components/AdminShell";
import AdminSecurityClient from "@/components/AdminSecurityClient";

export default function AdminSeguridadPage() {
  return (
    <AdminShell
      title="Seguridad"
      subtitle="Escaneos, scrapers, fallos de auth y bloqueo de IPs."
    >
      <AdminSecurityClient />
    </AdminShell>
  );
}
