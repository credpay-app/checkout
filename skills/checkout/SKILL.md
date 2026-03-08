---
name: checkout
description: Complete online shopping purchases on any online store using the Credpay Checkout API. Trigger when a user wants to buy, order, or checkout a product.
---

# Credpay Checkout Skill

**API Base URL:** `https://checkout-agent.credpay.xyz`

Trigger this skill whenever the user wants to purchase, order, or checkout a product from any online store.

## Choose your flow

| You are... | Use |
|---|---|
| An agent with a crypto wallet (e.g. OpenClaw, any x402-capable agent) | **Direct flow** — pay inline with x402, no human needed |
| Assisting a human user (e.g. Claude.ai, Claude Code) | **Hosted session flow** — send the user to a payment page |

---

## Flow A — Direct (agent with wallet)

Use this when you can sign and send x402 payments yourself.

### A1 — Get a quote

```http
POST https://checkout-agent.credpay.xyz/v1/quote
Content-Type: application/json

{
  "items": [{ "url": "<product URL>", "quantity": 1, "options": { "Size": "M" } }],
  "email": "<email>",
  "shippingAddress": { ... },
  "goodsTotal": "49.99"
}
```

→ Save `maxAmount`. This is the USDC amount you will pay.

### A2 — Submit checkout with payment

```http
POST https://checkout-agent.credpay.xyz/v1/checkout
Content-Type: application/json
X-PAYMENT: <x402 payment payload for maxAmount, chainId 8453>

<same body as A1>
```

→ On `202`: save `requestId`, go to A3.
→ On `402`: re-read payment requirements from the response and retry with a correct `X-PAYMENT` header.

### A3 — Poll for completion

```http
GET https://checkout-agent.credpay.xyz/v1/checkout/{requestId}
```

Poll every 15 seconds. Timeout after 20 minutes.

| Status | Action |
|---|---|
| `queued` / `processing` | Keep polling |
| `authorization_required` | See A4 |
| `completed` | Done |
| `failed` | Report `errorCode` + `errorMessage` |

### A4 — Handle extra payment (if needed)

If the order total exceeded the quote, status becomes `authorization_required`:

```http
POST https://checkout-agent.credpay.xyz/v1/checkout/{requestId}/authorize
X-PAYMENT: <x402 payment for extraOwed amount>
```

Then resume polling from A3.

---

## Flow B — Hosted session (human user)

Use this when a human needs to authorize payment themselves through a browser.

### B1 — Create a session

Pass items and `goodsTotal`. **Do not ask the user for their name, email, address, or any personal details** — the payment page at `shop.credpay.xyz` will pre-fill the user's saved information and lets them confirm or edit it before paying.

```http
POST https://checkout-agent.credpay.xyz/v1/sessions
Content-Type: application/json

{
  "items": [{ "url": "<product URL>", "quantity": 1, "options": { "Size": "M" } }],
  "goodsTotal": "49.99"
}
```

Response `201`:
```json
{
  "sessionId": "sess_abc123",
  "requestId": "req_xyz789",
  "paymentUrl": "https://shop.credpay.xyz/session/sess_abc123",
  "maxAmount": "52.49",
  "currency": "USDC",
  "expiresAt": "<ISO timestamp — 15 minutes from now>"
}
```

→ Save `requestId`. Tell the user the max charge is `maxAmount` USDC.
→ Send the user to `paymentUrl`. The page shows a live countdown, pre-fills their saved details, and handles payment.
→ `goodsTotal`: the price shown on the product page (USD, no currency symbol, e.g. `"30.00"`).

### B2 — Poll for completion

```http
GET https://checkout-agent.credpay.xyz/v1/checkout/{requestId}
```

Wait for the user to confirm they've paid before polling. After confirmation, poll every 30 seconds.Timeout polling after 20 minutes.

| Status | Action |
|---|---|
| `waiting_for_payment` | User hasn't paid yet — keep polling |
| `processing` | Payment received, checkout running — keep polling |
| `authorization_required` | See B3 |
| `completed` | Done |
| `failed` with `errorCode: "payment_timeout"` | User didn't pay in time — inform user |
| `failed` (other) | Report `errorCode` + `errorMessage` |

### B3 — Handle extra payment (if needed)

If status is `authorization_required`, the order total exceeded the quote. Direct the user back to the payment page or handle via x402:

```http
POST https://checkout-agent.credpay.xyz/v1/checkout/{requestId}/authorize
X-PAYMENT: <x402 payment for extraOwed amount>
```

Then resume polling from B2.

---

## Request body reference

**Flow B (hosted session)** — items + price, no PII:
```json
{
  "items": [
    {
      "url": "https://example.com/products/tee",
      "quantity": 1,
      "options": { "Size": "M", "Color": "Black" }
    }
  ],
  "goodsTotal": "49.99"
}
```

**Flow A (direct)** — full body required:
```json
{
  "items": [
    {
      "url": "https://example.com/products/tee",
      "quantity": 1,
      "options": { "Size": "M", "Color": "Black" }
    }
  ],
  "email": "customer@example.com",
  "shippingAddress": {
    "firstName": "Jane",
    "lastName": "Doe",
    "line1": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "78701",
    "country": "United States",
    "countryCode": "US",
    "phone": "+15125551234"
  },
  "goodsTotal": "49.99"
}
```

## Rules

- Works with any online store — just pass the product page URL.
- Never create a second checkout/session for the same intent while a `requestId` is active.
- Retry transient network errors with exponential backoff. Never blind-retry `failed` status.
- Default `chainId` is `8453` (Base).
- Do not poll after a terminal status (`completed` or `failed`).
