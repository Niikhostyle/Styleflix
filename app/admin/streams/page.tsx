import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminStreamsClient from "@/components/AdminStreamsClient";

export const metadata = {
  title: "Admin · Links propios | VeoTV",
};

export default async function AdminStreamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/streams");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");
  return <AdminStreamsClient />;
}
