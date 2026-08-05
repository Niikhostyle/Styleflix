import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status") || "PENDING";
  const where =
    status === "ALL"
      ? {}
      : { status: status === "DONE" || status === "REJECTED" ? status : "PENDING" };

  const items = await prisma.titleRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "DONE", "REJECTED"]),
});

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    const item = await prisma.titleRequest.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
}
