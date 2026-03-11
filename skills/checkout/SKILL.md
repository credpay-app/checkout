---
name: checkout
description: Complete online shopping purchases on any online store using the Credpay Checkout API. Trigger this skill whenever the user wants to buy, order, purchase, or checkout a product from any website — even if they just paste a product URL and say "buy this" or "order this for me." Also trigger when an autonomous agent needs to complete a purchase using a crypto wallet via x402 payment. Do not skip this skill for shopping or purchasing intent of any kind.
---

# Credpay Checkout Skill

**API Base URL:** `https://checkout-agent.credpay.xyz`

## Decide which flow to use

| Context | Flow |
|---|---|
| You are an autonomous agent with a crypto wallet (x402-capable) | **Flow A — Direct** |
| You are assisting a human user (e.g. in Claude.ai) | **Flow B — Hosted Session** |

When in doubt: if there's a human in the conversation who will authorize payment, use Flow B.

---

## Flow A — Direct (autonomous agent with wallet)

Use when you can sign and send x402 payments yourself. No human interaction required.

### Step 1 — Get a quote

```http
POST https://checkout-agent.credpay.xyz/v1/quote
Content-Type: application/json

{
  "items": [{ "url": "<product URL>", "quantity": 1, "options": { "Size": "M" } }],
  "email": "<email>",
  "shippingAddress": {
    "firstName": "...", "lastName": "...", "line1": "...",
    "city": "...", "state": "...", "postalCode": "...",
    "country": "United States", "countryCode": "US", "phone": "..."
  },
  "goodsTotal": "49.99"
}
```

Save `maxAmount` from the response — this is the USDC amount you'll pay.

### Step 2 — Submit checkout with payment

```http
POST https://checkout-agent.credpay.xyz/v1/checkout
Content-Type: application/json
X-PAYMENT: <x402 payment payload for maxAmount, chainId 8453>

<same body as Step 1>
```

- `202` → save `requestId`, go to Step 3
- `402` → re-read payment requirements from response, correct `X-PAYMENT`, retry

### Step 3 — Poll for completion

```http
GET https://checkout-agent.credpay.xyz/v1/checkout/{requestId}
```

Poll every 15 seconds. Stop after 20 minutes.

| Status | Action |
|---|---|
| `queued` / `processing` | Keep polling |
| `authorization_required` | Go to Step 4 |
| `completed` | ✅ Done |
| `failed` | Report `errorCode` + `errorMessage` to user |

### Step 4 — Handle extra payment (if needed)

If status is `authorization_required`, the order exceeded the quote:

```http
POST https://checkout-agent.credpay.xyz/v1/checkout/{requestId}/authorize
X-PAYMENT: <x402 payment for extraOwed amount>
```

Then resume polling from Step 3.

---

## Flow B — Hosted Session (human user)

Use when a human needs to authorize payment through their browser.

**Do not ask the user for their name, email, address, or any personal details.** The payment page pre-fills their saved info and lets them confirm before paying.

### Step 1 — Create a session

First, identify the product URL and price. Use this priority order:
1. **Price in user's message** — use it directly
2. **No price given** — fetch the product page URL and extract the listed price
3. **Can't determine price** — ask the user: *"What's the price listed on the product page?"*

Then:

```http
POST https://checkout-agent.credpay.xyz/v1/sessions
Content-Type: application/json

{
  "items": [{ "url": "<product URL>", "quantity": 1, "options": { "Size": "M" } }],
  "goodsTotal": "49.99"
}
```

- `goodsTotal`: price shown on the product page, USD, no currency symbol (e.g. `"30.00"`)
- Include `"options"` only if the user specified variants (size, color, etc.)

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

Save `requestId`. Present a concise summary of the order, then give the user two options using the `ask_user_input` tool:

1. Product name and any options selected
2. Max charge amount (`maxAmount` USDC)
3. Note the session expires in ~15 minutes

Then use `ask_user_input` with a single-select question:

- **"Continue to Credpay"** — just the payment link, user manages everything on Credpay
- **"Pay & track in Claude"** — payment link + live order tracking widget in Claude

Both options send the user to the Credpay hosted checkout to pay. The difference is whether Claude also renders a tracking widget.

**If user picks "Continue to Credpay":**

Send them the payment link and wait for confirmation:

> 👉 [Complete payment on Credpay](https://shop.credpay.xyz/session/sess_abc123)
>
> Let me know once you've paid and I'll check your order status.

**If user picks "Pay & track in Claude":**

1. Immediately send the payment link so the user can start paying:
   > 👉 [Complete payment on Credpay](https://shop.credpay.xyz/session/sess_abc123)

2. While they pay, render the tracking widget: read the template from `references/checkout-widget.jsx`, copy it into a new `.jsx` file, replace the `SESSION` object values with the actual session data, save to `/mnt/user-data/outputs/credpay-checkout.jsx`, and present to the user.

The widget automatically polls order status every 10 seconds, shows a live countdown, handles `authorization_required` with a payment breakdown card, and displays the final result — so the user can watch their order progress in real time after paying.

Replace these values in the `SESSION` object:

| Field | Source |
|---|---|
| `requestId` | `response.requestId` |
| `paymentUrl` | `response.paymentUrl` |
| `maxAmount` | `"$" + response.maxAmount` |
| `currency` | `response.currency` |
| `expiresAt` | `response.expiresAt` |
| `product.brand` | Store/brand name (extract from URL domain or product info) |
| `product.name` | Product name from user's request |
| `product.price` | `"$" + goodsTotal` |

### Step 2 — Poll for completion

After the user confirms they've paid, poll for the order status:

```http
GET https://checkout-agent.credpay.xyz/v1/checkout/{requestId}
```

Poll every 30 seconds. Stop after 20 minutes.

| Status | Action |
|---|---|
| `waiting_for_payment` | User hasn't paid yet — keep polling |
| `processing` | Payment received, order running — keep polling |
| `authorization_required` | See Step 3 |
| `completed` | ✅ Done — confirm order to user |
| `failed` with `errorCode: "payment_timeout"` | User didn't pay in time — let them know |
| `failed` (other) | Report `errorCode` + `errorMessage` |

### Step 3 — Handle extra payment (if needed)

If status is `authorization_required`, the order total exceeded the quote. Tell the user the breakdown (goods, shipping, total, extra owed) and direct them back to the same payment URL to authorize the additional amount.

For autonomous agents (Flow A), handle via x402:

```http
POST https://checkout-agent.credpay.xyz/v1/checkout/{requestId}/authorize
X-PAYMENT: <x402 payment for extraOwed amount>
```

Then resume polling from Step 2.

---

## Order Tracking

If the user asks to check the status of an existing order and provides a `requestId`:

```http
GET https://checkout-agent.credpay.xyz/v1/checkout/{requestId}
```

Report the status back to the user using plain language:

| Status | Tell the user |
|---|---|
| `waiting_for_payment` | Payment hasn't been received yet |
| `processing` | Payment received, order is being placed |
| `authorization_required` | Additional payment is needed — see Flow B Step 3 |
| `completed` | Order is complete |
| `failed` | Order failed — share `errorCode` and `errorMessage` |

Do not start a new checkout session if a `requestId` already exists for this intent.

---

## Rules

- Works with **any online store** — just pass the product page URL.
- **Never create a second session/checkout** for the same intent while a `requestId` is active.
- Retry transient network errors with exponential backoff. Never blind-retry a `failed` status.
- Default `chainId` is `8453` (Base).
- Stop polling immediately on `completed` or `failed`.
