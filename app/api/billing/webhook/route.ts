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

async function handleNotification(topic: string, dataId: string) {
  // Prueba de IPN de MP usa id=123456: responder 200 sin consultar API.
  if (!dataId || dataId === "123456") {
    return NextResponse.json({ ok: true, skipped: dataId ? "test_id" : "no id" });
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
      return NextResponse.json({ ok: true, skipped: "no user" });
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

    return NextResponse.json({ ok: true });
  }

  if (topic.includes("payment") || topic === "payment") {
    let payment;
    try {
      payment = await getPayment(dataId);
    } catch (err) {
      console.warn("[webhook] payment fetch", dataId, err);
      // 200 para que MP no reintente eternamente con ids inválidos de prueba
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
}

export async function POST(request: Request) {
  if (!verifyWebhookSignature(request)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  const raw = await request.text();
  let body: MpTopicBody = {};
  try {
    body = raw ? (JSON.parse(raw) as MpTopicBody) : {};
  } catch {
    body = {};
  }

  const { topic, dataId } = extractTopicAndId(request, body);

  try {
    return await handleNotification(topic, dataId);
  } catch (err) {
    console.error("[billing/webhook] POST", err);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}

/**
 * IPN legacy: MP hace GET/POST a ?topic=payment&id=...
 * También usan GET vacío para verificar la URL.
 */
export async function GET(request: Request) {
  if (!verifyWebhookSignature(request)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  const { topic, dataId } = extractTopicAndId(request, {});

  // Verificación simple sin topic: OK
  if (!topic && !dataId) {
    return NextResponse.json({ ok: true });
  }

  try {
    return await handleNotification(topic, dataId);
  } catch (err) {
    console.error("[billing/webhook] GET", err);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}
