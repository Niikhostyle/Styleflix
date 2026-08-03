import { NextResponse } from "next/server";

/** Registro público cerrado. Usar /api/admin/users (SUPER_ADMIN). */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "El registro público está desactivado. Pide una cuenta al administrador.",
    },
    { status: 403 }
  );
}
