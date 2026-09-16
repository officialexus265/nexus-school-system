# PayChangu integration (NEXUS)

Accept **mobile money (Airtel Money, TNM Mpamba), bank transfer, and card** via PayChangu hosted checkout.

## Setup

1. Create account: https://paychangu.com / https://in.paychangu.com/user/api  
2. Copy **Secret key** and **Webhook secret** into `.env`:

```
PAYCHANGU_SECRET_KEY=...
PAYCHANGU_WEBHOOK_SECRET=...
BETTER_AUTH_URL=https://your-domain.com
```

3. In PayChangu dashboard → API & Webhooks, set webhook URL to:

```
https://your-domain.com/api/paychangu/webhook
```

4. Without keys, the app runs in **demo mode** (fake checkout return URL).

## Flows

### School fees (staff Finance)
- Open charge → **Pay online (MoMo / Card / Bank)**  
- Redirect to PayChangu checkout → customer pays  
- Webhook + return URL call `fulfillPaychanguPayment` → updates charge + creates receipt

### Platform subscription invoices
- `/app/invoices` → **Pay online** on an unpaid invoice  
- Same checkout → marks invoice PAID and keeps school ACTIVE

## API used
- `POST https://api.paychangu.com/payment` — initiate checkout  
- `GET https://api.paychangu.com/verify-payment/{tx_ref}` — verify before fulfilling  
- Webhook: HMAC-SHA256 (`Signature` header) with webhook secret
