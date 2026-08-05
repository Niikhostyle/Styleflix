import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminRequestsClient from "@/components/AdminRequestsClient";

export const metadata = {
  title: "Admin · Solicitudes | VeoTV",
};

export default async function AdminSolicitudesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/solicitudes");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");
  return <AdminRequestsClient />;
}
