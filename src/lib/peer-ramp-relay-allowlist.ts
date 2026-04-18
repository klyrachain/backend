/**
 * Allowlist for `GET|POST /api/klyra/relay/*` → Core `/api/*`.
 * Mirror edits in `peer-ramp-frontend/src/lib/server-core-proxy.ts` (`isCoreProxyAllowed` / `isCoreProxyPublicGet`).
 */

export function isCoreRelayPublicGet(parts: string[]): boolean {
  if (parts[0] === "quote") return true;
  if (parts.join("/") === "rates/fiat/codes") return true;
  if (parts[0] === "countries") return true;
  return false;
}

export function isCoreRelayAllowed(method: string, parts: string[]): boolean {
  const m = method.toUpperCase();
  const j = parts.join("/");

  if (m === "GET" && parts[0] === "quote") return true;
  if (m === "GET" && j === "rates/fiat/codes") return true;
  if (m === "GET" && parts[0] === "countries") return true;

  if (m === "GET" && j === "peer-ramp/orders") return true;
  if (m === "GET" && parts[0] === "peer-ramp" && parts[1] === "orders" && parts.length === 3) return true;
  if (
    m === "GET" &&
    parts[0] === "peer-ramp" &&
    parts[1] === "orders" &&
    parts.length === 4 &&
    parts[3] === "escrow-tx"
  ) {
    return true;
  }

  if (m === "POST" && j === "peer-ramp/orders/onramp") return true;
  if (m === "POST" && j === "peer-ramp/orders/offramp") return true;
  if (
    m === "POST" &&
    parts[0] === "peer-ramp" &&
    parts[1] === "fills" &&
    parts.length === 4 &&
    parts[3] === "accept"
  ) {
    return true;
  }
  if (
    m === "POST" &&
    parts[0] === "peer-ramp" &&
    parts[1] === "orders" &&
    parts.length === 4 &&
    (parts[3] === "commit-onramp" || parts[3] === "submit-escrow-tx")
  ) {
    return true;
  }

  if (m === "GET" && parts[0] === "transactions" && parts.length === 2) return true;
  if (m === "GET" && parts[0] === "paystack" && parts[1] === "transactions" && parts[2] === "verify" && parts.length === 4) {
    return true;
  }
  if (m === "GET" && parts[0] === "paystack" && parts[1] === "banks") {
    if (parts.length === 2) return true;
    if (parts.length === 3 && parts[2] === "resolve") return true;
  }
  if (m === "GET" && j === "paystack/mobile/providers") return true;

  if (
    m === "GET" &&
    parts[0] === "public" &&
    parts[1] === "payment-links" &&
    parts[2] === "gas-checkout" &&
    parts.length === 4
  ) {
    return true;
  }
  if (m === "GET" && parts[0] === "public" && parts[1] === "payment-links" && parts[2] === "by-id" && parts.length === 4) {
    return true;
  }
  if (m === "GET" && parts[0] === "public" && parts[1] === "payment-links" && parts.length === 3) return true;
  if (m === "GET" && parts[0] === "requests" && parts[1] === "by-link" && parts.length === 3) return true;
  if (m === "POST" && parts[0] === "requests" && parts.length === 1) return true;
  if (m === "POST" && j === "public/gas-usage") return true;
  if (m === "GET" && parts[0] === "public" && parts[1] === "gas-policy") return true;
  if (m === "POST" && j === "v1/quotes") return true;
  if (m === "POST" && j === "v1/quotes/checkout") return true;
  if (m === "POST" && j === "payment-link-dispatch") return true;
  if (m === "POST" && j === "app-transfer/intent") return true;
  if (m === "GET" && j === "public/wrapped/wallet") return true;

  return false;
}
