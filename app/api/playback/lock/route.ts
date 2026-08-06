import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { requireLiveCatalogAccess } from "@/lib/access";
import { clientIpFromHeaders } from "@/lib/security";
import {
  acquirePlaybackLock,
  heartbeatPlaybackLock,
  releasePlaybackLock,
} from "@/lib/playback-lock";
import { getSelectedProfileId } from "@/lib/profiles";

async function denyIfNoLiveAccess(userId: string) {
  const live = await requireLiveCatalogAccess(userId);
  if (!live.ok) {
    return NextResponse.json({ error: live.error }, { status: live.status });
  }
  return null;
}

const acquireSchema = z.object({
  profileId: z.string().min(1).optional(),
  deviceId: z.string().min(8).max(80),
  titleLabel: z.string().max(120).optional(),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const denied = await denyIfNoLiveAccess(session.user.id);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const parsed = acquireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const cookieProfile = await getSelectedProfileId();
  const profileId = parsed.data.profileId || cookieProfile;
  if (!profileId) {
    return NextResponse.json(
      { error: "Selecciona un perfil primero.", code: "NO_PROFILE" },
      { status: 403 }
    );
  }

  // SUPER_ADMIN: lock opcional (sigue pudiendo adquirir para pruebas)
  const result = await acquirePlaybackLock({
    userId: session.user.id,
    profileId,
    deviceId: parsed.data.deviceId,
    titleLabel: parsed.data.titleLabel,
    ip: clientIpFromHeaders(request.headers),
    userAgent: request.headers.get("user-agent"),
    force: Boolean(parsed.data.force),
  });

  if (!result.ok) {
    if ("conflict" in result && result.conflict) {
      return NextResponse.json(
        {
          error: result.error,
          code: "PROFILE_IN_USE",
          lastHeartbeat: result.lastHeartbeat,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: result.error },
      { status: "status" in result ? result.status : 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    lockToken: result.lockToken,
    profileId: result.profileId,
    staleTaken: Boolean(result.staleTaken),
  });
}

const heartbeatSchema = z.object({
  profileId: z.string().min(1),
  deviceId: z.string().min(8).max(80),
  lockToken: z.string().min(8),
});

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const parsed = heartbeatSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const result = await heartbeatPlaybackLock({
    userId: session.user.id,
    ...parsed.data,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true });
}

const releaseSchema = z.object({
  profileId: z.string().min(1),
  deviceId: z.string().min(8).max(80),
  lockToken: z.string().min(8).optional(),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const parsed = releaseSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  await releasePlaybackLock({
    userId: session.user.id,
    ...parsed.data,
  });
  return NextResponse.json({ ok: true });
}
