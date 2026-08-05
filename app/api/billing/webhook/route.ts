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

export const dynamic = "force-dynamic";

type MpTopicBody = {
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string | number };
  id?: string | number;
};

/** MP IPN test espera HTTP 200/201; texto plano es lo más compatible. */
function ack(extra?: Record<string, unknown>) {
  if (extra && process.env.NODE_ENV !== "production") {
    return NextResponse.json({ ok: true, ...extra });
  }
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function resolveUserId(
  externalRef?: string | null,
  preapprovalId?: string
) {
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

function extractTopicAndId(request: Request, body: MpTopicBody) {
  const url = new URL(request.url);
  const topic = (
    body.type ||
    body.topic ||
    body.action ||
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    ""
  ).toLowerCase();

  const rawId =
    body.data?.id ??
    body.id ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    "";

  return { topic, dataId: String(rawId || "").trim() };
}

function isMpTestId(dataId: string) {
  // ids fijos que usa el panel IPN de Mercado Pago
  return dataId === "123456" || dataId === "123456789";
}

async function handleNotification(topic: string, dataId: string) {
  if (!dataId || isMpTestId(dataId)) {
    return ack({ skipped: dataId ? "test_id" : "no id" });
  }

  if (
    topic.includes("subscription") ||
    topic.includes("preapproval") ||
    topic === "subscription_preapproval"
  ) {
    const preapproval = await getPreapproval(dataId);
    const userId = await resolveUserId(
      preapproval.external_reference,
      preapproval.id
    );
    if (!userId) {
      console.warn("[webhook] preapproval sin usuario", dataId);
      return ack({ skipped: "no user" });
    }

    const status = (preapproval.status || "").toLowerCase();
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

    return ack();
  }

  if (topic.includes("payment") || topic === "payment") {
    let payment;
    try {
      payment = await getPayment(dataId);
    } catch (err) {
      console.warn("[webhook] payment fetch", dataId, err);
      // Siempre 200: si no, MP reintenta / marca la URL como inválida
      return ack({ skipped: "payment fetch fail" });
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
      return ack({ skipped: "payment no user" });
    }

    const status = (payment.status || "").toLowerCase();

    if (status === "approved") {
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

    return ack();
  }

  return ack({ skipped: topic || "unknown" });
}

async function readBody(request: Request): Promise<MpTopicBody> {
  try {
    const raw = await request.text();
    if (!raw?.trim()) return {};
    return JSON.parse(raw) as MpTopicBody;
  } catch {
    return {};
  }
}

/**
 * IPN legacy: GET ?topic=payment&id=...
 * No exigir firma: la prueba del panel no envía x-signature.
 */
export async function GET(request: Request) {
  const { topic, dataId } = extractTopicAndId(request, {});
  try {
    return await handleNotification(topic, dataId);
  } catch (err) {
    console.error("[billing/webhook] GET", err);
    // Nunca 4xx/5xx en la sonda: MP marca la URL como fallida
    return ack({ error: "handled" });
  }
}

export async function POST(request: Request) {
  // Firma solo informativa: IPN legacy no envía x-signature.
  if (!verifyWebhookSignature(request)) {
    console.warn("[billing/webhook] firma inválida; se ack igual para no romper IPN");
  }

  const body = await readBody(request);
  const parsed = extractTopicAndId(request, body);

  try {
    return await handleNotification(parsed.topic, parsed.dataId);
  } catch (err) {
    console.error("[billing/webhook] POST", err);
    return ack({ error: "handled" });
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: "GET, POST, HEAD, OPTIONS",
    },
  });
}
