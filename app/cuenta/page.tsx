import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AccountClient from "@/components/AccountClient";

export const metadata = {
  title: "Mi cuenta | VeoTV",
};

export default async function CuentaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/cuenta");
  return <AccountClient />;
}
