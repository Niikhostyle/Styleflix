import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role, SubscriptionStatus } from "@/lib/access";
import { hasActiveMembership } from "@/lib/access";
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
    planTier: string | null;
    planMaxProfiles: number | null;
    planMaxResolution: number | null;
    planCanRequest: boolean;
    planCanDownload: boolean;
  }
}

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
  planTier?: string | null;
  planMaxProfiles?: number | null;
  planMaxResolution?: number | null;
  planFeatures?: unknown;
}) {
  const subscriptionStatus = user.subscriptionStatus as SubscriptionStatus;
  const currentPeriodEnd = user.currentPeriodEnd
    ? user.currentPeriodEnd.toISOString()
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
  return {
    role: user.role as Role,
    subscriptionStatus,
    currentPeriodEnd,
    membershipActive: hasActiveMembership({
      role: user.role,
      subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
    }),
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
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        if (!user.emailVerified) {
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
        }

        if (user.subscriptionStatus === "PREPAID") {
          const activated = await activatePrepaidOnFirstUse(user.id);
          if (activated) user = activated;
        }

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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.subscriptionStatus = user.subscriptionStatus;
        token.currentPeriodEnd = user.currentPeriodEnd;
        token.membershipActive = user.membershipActive;
        token.planTier = user.planTier;
        token.planMaxProfiles = user.planMaxProfiles;
        token.planMaxResolution = user.planMaxResolution;
        token.planCanRequest = user.planCanRequest;
        token.planCanDownload = user.planCanDownload;
      }

      if ((trigger === "update" || user) && token.id) {
        let dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            role: true,
            name: true,
            email: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
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
          token.planTier = membership.planTier;
          token.planMaxProfiles = membership.planMaxProfiles;
          token.planMaxResolution = membership.planMaxResolution;
          token.planCanRequest = membership.planCanRequest;
          token.planCanDownload = membership.planCanDownload;
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
