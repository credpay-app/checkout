# Checkout Widget (Reference)

This is a standalone React checkout widget for Credpay. It is **not used by the skill** — the default Flow B uses the hosted checkout at `shop.credpay.xyz` instead.

This widget is kept here as a reference for embedding Credpay checkout in non-Claude contexts (custom apps, sandboxed environments, etc.).

## Usage

1. Copy `checkout-widget.jsx` into your project
2. Replace the `SESSION` object with real session data from `POST /v1/sessions`
3. Render as a React component

## Features

- Figtree font, Credpay brand colors (`#0A2740`, `#0BD751`), inline SVG logo
- Two-step flow: Pay on Credpay (redirect) → Track Order (polls `/v1/checkout/{requestId}`)
- Handles `authorization_required` with payment breakdown card
- Live countdown timer, status indicators, raw JSON response view
