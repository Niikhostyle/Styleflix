import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminUserDetailClient from "@/components/AdminUserDetailClient";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");

  const { id } = await params;
  return <AdminUserDetailClient userId={id} />;
}
