import { createFileRoute } from "@tanstack/react-router";
import { fulfillPaychanguPayment } from "@/lib/nexus/server";
import { verifyWebhookSignature } from "@/lib/nexus/paychangu";

export const Route = createFileRoute("/api/paychangu/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature =
          request.headers.get("Signature") ||
          request.headers.get("signature") ||
          request.headers.get("x-paychangu-signature");

        // In demo without keys, accept; with keys, verify HMAC
        const hasSecret = Boolean(process.env.PAYCHANGU_WEBHOOK_SECRET || process.env.PAYCHANGU_SECRET_KEY);
        if (hasSecret) {
          const valid = await verifyWebhookSignature(rawBody, signature);
          if (!valid) {
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        let payload: {
          status?: string;
          tx_ref?: string;
          reference?: string;
          charge_id?: string;
          event_type?: string;
        } = {};
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const status = (payload.status || "").toLowerCase();
        if (status !== "success" && status !== "successful") {
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Standard checkout uses tx_ref; some payloads use charge_id / reference
        const txRef = payload.tx_ref || payload.reference || payload.charge_id;
        if (!txRef) {
          return new Response(JSON.stringify({ error: "Missing tx_ref" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await fulfillPaychanguPayment(String(txRef));
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[paychangu webhook]", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: () =>
        new Response(JSON.stringify({ ok: true, service: "paychangu-webhook" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
