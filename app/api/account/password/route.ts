import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordChangedNotice } from "@/lib/mail";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(72),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser distinta a la actual." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const valid = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  void sendPasswordChangedNotice({
    to: user.email,
    name: user.name,
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    message: "Contraseña actualizada correctamente.",
  });
}
