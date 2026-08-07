import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role, SubscriptionStatus } from "@/lib/access";
import { hasActiveDemo, hasActiveMembership, hasCatalogAccess } from "@/lib/access";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { activatePrepaidOnFirstUse } from "@/lib/membership";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

declare module "next-auth" {
  interface User {
    role: Role;
    subscriptionStatus: SubscriptionStatus;
    currentPeriodEnd: string | null;
    membershipActive: boolean;
    demoExpiresAt: string | null;
    demoActive: boolean;
    catalogAccess: boolean;
    planTier: string | null;
    planMaxProfiles: number | null;
    planMaxResolution: number | null;
    planCanRequest: boolean;
    planCanDownload: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      subscriptionStatus: SubscriptionStatus;
      currentPeriodEnd: string | null;
      membershipActive: boolean;
      demoExpiresAt: string | null;
      demoActive: boolean;
      catalogAccess: boolean;
      planTier: string | null;
      planMaxProfiles: number | null;
      planMaxResolution: number | null;
      planCanRequest: boolean;
      planCanDownload: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    subscriptionStatus: SubscriptionStatus;
    currentPeriodEnd: string | null;
    membershipActive: boolean;
    demoExpiresAt: string | null;
    demoActive: boolean;
    catalogAccess: boolean;
    planTier: string | null;
    planMaxProfiles: number | null;
    planMaxResolution: number | null;
    planCanRequest: boolean;
    planCanDownload: boolean;
    /** Epoch ms del último refresh de membresía desde DB */
    accessCheckedAt?: number;
  }
}

/** Releer membresía/demo desde DB al menos cada N ms (post-revoke admin). */
const JWT_ACCESS_REFRESH_MS = 20_000;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const authSecret = resolveAuthSecret();
if (!authSecret) {
  console.error(
    "[auth] Falta AUTH_SECRET (o NEXTAUTH_SECRET) en el entorno del contenedor."
  );
}

function membershipFromUser(user: {
  role: string;
  subscriptionStatus: string;
  currentPeriodEnd: Date | null;
  demoExpiresAt?: Date | null;
  planTier?: string | null;
  planMaxProfiles?: number | null;
  planMaxResolution?: number | null;
  planFeatures?: unknown;
}) {
  const subscriptionStatus = user.subscriptionStatus as SubscriptionStatus;
  const currentPeriodEnd = user.currentPeriodEnd
    ? user.currentPeriodEnd.toISOString()
    : null;
  const demoExpiresAt = user.demoExpiresAt
    ? user.demoExpiresAt.toISOString()
    : null;
  const features =
    user.planFeatures &&
    typeof user.planFeatures === "object" &&
    !Array.isArray(user.planFeatures)
      ? (user.planFeatures as {
          canRequest?: boolean;
          canDownload?: boolean;
        })
      : {};
  const fields = {
    role: user.role,
    subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    demoExpiresAt: user.demoExpiresAt ?? null,
  };
  return {
    role: user.role as Role,
    subscriptionStatus,
    currentPeriodEnd,
    membershipActive: hasActiveMembership(fields),
    demoExpiresAt,
    demoActive: hasActiveDemo(fields),
    catalogAccess: hasCatalogAccess(fields),
    planTier: user.planTier ?? null,
    planMaxProfiles: user.planMaxProfiles ?? null,
    planMaxResolution: user.planMaxResolution ?? null,
    planCanRequest: Boolean(features.canRequest),
    planCanDownload: Boolean(features.canDownload),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        let user;
        try {
          const { withPrismaRetry } = await import("@/lib/prisma");
          user = await withPrismaRetry(() =>
            prisma.user.findUnique({ where: { email } })
          );
        } catch (err) {
          console.error("[auth] DB unavailable during login", err);
          return null;
        }
        if (!user) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        if (!user.emailVerified) {
          try {
            const pending = await prisma.authToken.findFirst({
              where: {
                userId: user.id,
                type: "EMAIL_VERIFY",
                usedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: { id: true },
            });
            if (pending) {
              throw new EmailNotVerifiedError();
            }
          } catch (err) {
            if (err instanceof EmailNotVerifiedError) throw err;
            console.error("[auth] verify-token check failed", err);
            return null;
          }
        }

        if (user.subscriptionStatus === "PREPAID") {
          const activated = await activatePrepaidOnFirstUse(user.id);
          if (activated) user = activated;
        }

        // Marca última conexión al login (IP real se completa en heartbeat)
        await prisma.user
          .update({
            where: { id: user.id },
            data: { lastSeenAt: new Date() },
          })
          .catch(() => null);

        const membership = membershipFromUser(user);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          ...membership,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.subscriptionStatus = user.subscriptionStatus;
        token.currentPeriodEnd = user.currentPeriodEnd;
        token.membershipActive = user.membershipActive;
        token.demoExpiresAt = user.demoExpiresAt;
        token.demoActive = user.demoActive;
        token.catalogAccess = user.catalogAccess;
        token.planTier = user.planTier;
        token.planMaxProfiles = user.planMaxProfiles;
        token.planMaxResolution = user.planMaxResolution;
        token.planCanRequest = user.planCanRequest;
        token.planCanDownload = user.planCanDownload;
        token.accessCheckedAt = Date.now();
      }

      // Demo post-pago: solo fechas tipadas; NUNCA confiar catalogAccess del cliente.
      // El refresh DB debajo es la fuente de verdad.
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as {
          demoExpiresAt?: string | null;
          planTier?: string | null;
          planMaxProfiles?: number | null;
          planMaxResolution?: number | null;
        };
        if (s.demoExpiresAt !== undefined) {
          token.demoExpiresAt = s.demoExpiresAt;
        }
        if (s.planTier !== undefined) token.planTier = s.planTier;
        if (s.planMaxProfiles !== undefined) {
          token.planMaxProfiles = s.planMaxProfiles;
        }
        if (s.planMaxResolution !== undefined) {
          token.planMaxResolution = s.planMaxResolution;
        }
      }

      const shouldRefreshDb =
        Boolean(token.id) &&
        (Boolean(user) ||
          trigger === "update" ||
          !token.accessCheckedAt ||
          Date.now() - Number(token.accessCheckedAt) >= JWT_ACCESS_REFRESH_MS);

      if (shouldRefreshDb && token.id) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              role: true,
              name: true,
              email: true,
              subscriptionStatus: true,
              currentPeriodEnd: true,
              demoExpiresAt: true,
              planTier: true,
              planMaxProfiles: true,
              planMaxResolution: true,
              planFeatures: true,
            },
          });

          if (dbUser?.subscriptionStatus === "PREPAID") {
            const activated = await activatePrepaidOnFirstUse(dbUser.id);
            if (activated) {
              dbUser = {
                id: activated.id,
                role: activated.role,
                name: activated.name,
                email: activated.email,
                subscriptionStatus: activated.subscriptionStatus,
                currentPeriodEnd: activated.currentPeriodEnd,
                demoExpiresAt: activated.demoExpiresAt,
                planTier: activated.planTier,
                planMaxProfiles: activated.planMaxProfiles,
                planMaxResolution: activated.planMaxResolution,
                planFeatures: activated.planFeatures,
              };
            }
          }

          if (dbUser) {
            const membership = membershipFromUser(dbUser);
            token.role = membership.role;
            token.name = dbUser.name;
            token.email = dbUser.email;
            token.subscriptionStatus = membership.subscriptionStatus;
            token.currentPeriodEnd = membership.currentPeriodEnd;
            token.membershipActive = membership.membershipActive;
            token.demoExpiresAt = membership.demoExpiresAt;
            token.demoActive = membership.demoActive;
            token.catalogAccess = membership.catalogAccess;
            token.planTier = membership.planTier;
            token.planMaxProfiles = membership.planMaxProfiles;
            token.planMaxResolution = membership.planMaxResolution;
            token.planCanRequest = membership.planCanRequest;
            token.planCanDownload = membership.planCanDownload;
            token.accessCheckedAt = Date.now();
          }
        } catch (err) {
          console.error("[auth] jwt refresh", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.subscriptionStatus =
          (token.subscriptionStatus as SubscriptionStatus) || "NONE";
        session.user.currentPeriodEnd =
          (token.currentPeriodEnd as string | null) ?? null;
        session.user.membershipActive = Boolean(token.membershipActive);
        session.user.demoExpiresAt =
          (token.demoExpiresAt as string | null) ?? null;
        session.user.demoActive = Boolean(token.demoActive);
        session.user.catalogAccess = Boolean(token.catalogAccess);
        session.user.planTier = (token.planTier as string | null) ?? null;
        session.user.planMaxProfiles =
          (token.planMaxProfiles as number | null) ?? null;
        session.user.planMaxResolution =
          (token.planMaxResolution as number | null) ?? null;
        session.user.planCanRequest = Boolean(token.planCanRequest);
        session.user.planCanDownload = Boolean(token.planCanDownload);
      }
      return session;
    },
  },
  trustHost: true,
});
