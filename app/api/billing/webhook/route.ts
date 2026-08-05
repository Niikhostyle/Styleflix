import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPayment,
  getPreapproval,
  membershipAmount,
  verifyWebhookSignature,
} from "@/lib/mercadopago";
import {
  activateFromMercadoPagoPayment,
  activateMembership,
  markSubscriptionStatus,
} from "@/lib/membership";

type MpTopicBody = {
  type?: string;
  action?: string;
  data?: { id?: string };
};

async function resolveUserId(externalRef?: string | null, preapprovalId?: string) {
  if (externalRef) {
    const byId = await prisma.user.findUnique({ where: { id: externalRef } });
    if (byId) return byId.id;
  }
  if (preapprovalId) {
    const byMp = await prisma.user.findFirst({
      where: { mpPreapprovalId: preapprovalId },
    });
    if (byMp) return byMp.id;
  }
  return null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(request)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let body: MpTopicBody = {};
  try {
    body = raw ? (JSON.parse(raw) as MpTopicBody) : {};
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const topic =
    body.type ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    "";
  const dataId =
    body.data?.id ||
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";

  try {
    if (
      topic.includes("subscription") ||
      topic.includes("preapproval") ||
      topic === "subscription_preapproval"
    ) {
      if (!dataId) {
        return NextResponse.json({ ok: true, skipped: "no id" });
      }

      const preapproval = await getPreapproval(dataId);
      const userId = await resolveUserId(
        preapproval.external_reference,
        preapproval.id
      );
      if (!userId) {
        console.warn("[webhook] preapproval sin usuario", dataId);
        return NextResponse.json({ ok: true, skipped: "no user" });
      }

      const status = (preapproval.status || "").toLowerCase();
      // Solo activar con suscripción realmente autorizada/activa (no pending).
      if (status === "authorized" || status === "active") {
        await activateMembership({
          userId,
          months: 1,
          mpPreapprovalId: preapproval.id,
          payment: {
            externalId: preapproval.id,
            status: "subscription_authorized",
            amount: await membershipAmount(),
            rawPayload: preapproval as object,
          },
        });
      } else if (status === "paused") {
        await markSubscriptionStatus(userId, "PAST_DUE", {
          mpPreapprovalId: preapproval.id,
        });
      } else if (status === "cancelled") {
        await markSubscriptionStatus(userId, "CANCELLED", {
          mpPreapprovalId: preapproval.id,
        });
      } else if (status === "pending") {
        await markSubscriptionStatus(userId, "PENDING", {
          mpPreapprovalId: preapproval.id,
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (topic.includes("payment") || topic === "payment") {
      if (!dataId) {
        return NextResponse.json({ ok: true, skipped: "payment no id" });
      }

      let payment;
      try {
        payment = await getPayment(dataId);
      } catch {
        return NextResponse.json({ ok: true, skipped: "payment fetch fail" });
      }

      const metaPreapproval =
        payment.metadata &&
        typeof payment.metadata === "object" &&
        "preapproval_id" in payment.metadata
          ? String(
              (payment.metadata as { preapproval_id?: unknown }).preapproval_id ||
                ""
            )
          : undefined;

      const userId = await resolveUserId(
        payment.external_reference,
        metaPreapproval || undefined
      );
      if (!userId) {
        return NextResponse.json({ ok: true, skipped: "payment no user" });
      }

      const status = (payment.status || "").toLowerCase();

      if (status === "approved") {
        // Solo activa si MP confirma approved + monto + external_reference.
        await activateFromMercadoPagoPayment({ userId, payment });
      } else if (status === "rejected" || status === "cancelled") {
        const externalId = String(payment.id);
        const dup = await prisma.payment.findFirst({ where: { externalId } });
        if (!dup) {
          await prisma.payment.create({
            data: {
              userId,
              externalId,
              amount: payment.transaction_amount ?? (await membershipAmount()),
              currency: "CLP",
              status,
              rawPayload: payment as object,
            },
          });
        }
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, skipped: topic || "unknown" });
  } catch (err) {
    console.error("[billing/webhook]", err);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}

/** MP a veces hace GET de verificación. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
