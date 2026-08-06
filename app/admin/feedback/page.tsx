import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminFeedbackClient from "@/components/AdminFeedbackClient";

export const metadata = {
  title: "Admin · Feedback | VeoTV",
};

export default async function AdminFeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/feedback");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");
  return <AdminFeedbackClient />;
}
