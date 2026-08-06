import { prisma } from "@/lib/prisma";
import { newLockToken, PLAYBACK_LOCK_STALE_MS } from "@/lib/profiles";

export type AcquireResult =
  | {
      ok: true;
      lockToken: string;
      profileId: string;
      staleTaken?: boolean;
    }
  | {
      ok: false;
      conflict: true;
      error: string;
      occupiedByDevice?: boolean;
      lastHeartbeat?: string;
    }
  | { ok: false; error: string; status: number };

export async function acquirePlaybackLock(opts: {
  userId: string;
  profileId: string;
  deviceId: string;
  titleLabel?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Si true, fuerza toma del perfil (solo dueño confirma “echar” tras aviso). Por defecto false. */
  force?: boolean;
}): Promise<AcquireResult> {
  const deviceId = opts.deviceId.trim().slice(0, 80);
  if (!deviceId || deviceId.length < 8) {
    return { ok: false, error: "Dispositivo inválido.", status: 400 };
  }

  const profile = await prisma.profile.findFirst({
    where: { id: opts.profileId, userId: opts.userId },
    select: { id: true, name: true },
  });
  if (!profile) {
    return { ok: false, error: "Perfil no encontrado.", status: 404 };
  }

  const now = new Date();
  const existing = await prisma.profilePlaybackLock.findUnique({
    where: { profileId: profile.id },
  });

  if (!existing) {
    const lockToken = newLockToken();
    await prisma.profilePlaybackLock.create({
      data: {
        profileId: profile.id,
        userId: opts.userId,
        deviceId,
        lockToken,
        titleLabel: opts.titleLabel?.slice(0, 120) || null,
        ip: opts.ip || null,
        userAgent: opts.userAgent?.slice(0, 400) || null,
        acquiredAt: now,
        lastHeartbeat: now,
      },
    });
    return { ok: true, lockToken, profileId: profile.id };
  }

  const age = now.getTime() - existing.lastHeartbeat.getTime();
  const stale = age > PLAYBACK_LOCK_STALE_MS;

  // Mismo dispositivo: renueva
  if (existing.deviceId === deviceId) {
    const lockToken = existing.lockToken || newLockToken();
    await prisma.profilePlaybackLock.update({
      where: { profileId: profile.id },
      data: {
        lockToken,
        lastHeartbeat: now,
        titleLabel: opts.titleLabel?.slice(0, 120) || existing.titleLabel,
        ip: opts.ip || existing.ip,
        userAgent: opts.userAgent?.slice(0, 400) || existing.userAgent,
      },
    });
    return { ok: true, lockToken, profileId: profile.id };
  }

  // Otro dispositivo y lock vivo → conflicto estricto
  if (!stale && !opts.force) {
    return {
      ok: false,
      conflict: true,
      occupiedByDevice: true,
      lastHeartbeat: existing.lastHeartbeat.toISOString(),
      error:
        `El perfil «${profile.name}» ya está en uso en otro dispositivo. ` +
        `Solo 1 persona puede mirar por perfil. Cierra la reproducción allí o espera ~1 minuto sin actividad.`,
    };
  }

  // Stale o force: toma el control
  const lockToken = newLockToken();
  await prisma.profilePlaybackLock.update({
    where: { profileId: profile.id },
    data: {
      deviceId,
      lockToken,
      titleLabel: opts.titleLabel?.slice(0, 120) || null,
      ip: opts.ip || null,
      userAgent: opts.userAgent?.slice(0, 400) || null,
      acquiredAt: now,
      lastHeartbeat: now,
    },
  });
  return {
    ok: true,
    lockToken,
    profileId: profile.id,
    staleTaken: true,
  };
}

export async function heartbeatPlaybackLock(opts: {
  userId: string;
  profileId: string;
  deviceId: string;
  lockToken: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await prisma.profilePlaybackLock.findUnique({
    where: { profileId: opts.profileId },
  });
  if (!row || row.userId !== opts.userId) {
    return { ok: false, error: "Sin sesión de reproducción.", status: 404 };
  }
  if (row.deviceId !== opts.deviceId || row.lockToken !== opts.lockToken) {
    return {
      ok: false,
      error:
        "Este perfil está reproduciendo en otro dispositivo. Tu sesión se cerró.",
      status: 409,
    };
  }
  await prisma.profilePlaybackLock.update({
    where: { profileId: opts.profileId },
    data: { lastHeartbeat: new Date() },
  });
  return { ok: true };
}

export async function releasePlaybackLock(opts: {
  userId: string;
  profileId: string;
  deviceId: string;
  lockToken?: string | null;
}) {
  const row = await prisma.profilePlaybackLock.findUnique({
    where: { profileId: opts.profileId },
  });
  if (!row || row.userId !== opts.userId) return;
  // Solo el dueño del lock puede liberar (evita que otro device limpie)
  if (row.deviceId !== opts.deviceId) return;
  if (opts.lockToken && row.lockToken !== opts.lockToken) return;
  await prisma.profilePlaybackLock
    .delete({ where: { profileId: opts.profileId } })
    .catch(() => null);
}

/** Valida que el request de play tenga el lock vigente de este perfil/dispositivo. */
export async function assertPlaybackLock(opts: {
  userId: string;
  profileId: string | null | undefined;
  deviceId: string | null | undefined;
  lockToken: string | null | undefined;
  /** SUPER_ADMIN puede saltarse en pruebas */
  bypass?: boolean;
}): Promise<{ ok: true; profileId: string } | { ok: false; error: string; status: number }> {
  if (opts.bypass) {
    return { ok: true, profileId: opts.profileId || "admin" };
  }
  if (!opts.profileId || !opts.deviceId || !opts.lockToken) {
    return {
      ok: false,
      error: "Selecciona un perfil e inicia la reproducción correctamente.",
      status: 403,
    };
  }

  const profile = await prisma.profile.findFirst({
    where: { id: opts.profileId, userId: opts.userId },
    select: { id: true },
  });
  if (!profile) {
    return { ok: false, error: "Perfil inválido.", status: 403 };
  }

  const row = await prisma.profilePlaybackLock.findUnique({
    where: { profileId: profile.id },
  });
  if (!row) {
    return {
      ok: false,
      error: "No hay sesión de reproducción activa para este perfil.",
      status: 403,
    };
  }
  if (row.deviceId !== opts.deviceId || row.lockToken !== opts.lockToken) {
    return {
      ok: false,
      error: "Este perfil ya está en uso en otro dispositivo.",
      status: 409,
    };
  }

  const age = Date.now() - row.lastHeartbeat.getTime();
  if (age > PLAYBACK_LOCK_STALE_MS * 2) {
    return {
      ok: false,
      error: "La sesión de reproducción expiró. Vuelve a reproducir.",
      status: 409,
    };
  }

  // Touch ligero
  await prisma.profilePlaybackLock
    .update({
      where: { profileId: profile.id },
      data: { lastHeartbeat: new Date() },
    })
    .catch(() => null);

  return { ok: true, profileId: profile.id };
}

export function playbackHeadersFromRequest(request: Request) {
  return {
    profileId: request.headers.get("x-veotv-profile-id"),
    deviceId: request.headers.get("x-veotv-device-id"),
    lockToken: request.headers.get("x-veotv-playback-token"),
  };
}
