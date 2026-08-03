import { redirect } from "next/navigation";

export const metadata = {
  title: "Registro",
};

/** Registro público deshabilitado: solo el Super Admin crea cuentas. */
export default function RegistroPage() {
  redirect("/login");
}
