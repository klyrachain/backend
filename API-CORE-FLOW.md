# Backend API — Core Integration & Flows

**Purpose:** This document describes **this backend** as the frontend-facing API: how it protects the Core server, what it provides natively vs via proxy, and the end-to-end flows (onramp, offramp, request & claim) as a frontend would use them.

**Audience:** Frontend and integration developers.  
**See also:** `API.md` (all endpoints and request/response), `integrations/core-intergrate.md` (proxy integration guide), `integrations/core-test.ts` and `integrations/core-test-2.ts` (E2E CLI flows — reference for Core behavior).

---

## 1. Architecture

```
[Frontend]  ←→  [This Backend]  ←→  [Core]
                     │
                     ├── Native: health, chains/tokens/balances (Squid + data), moolre, ens, rates
                     └── Proxy:  /api/klyra/*  →  Core (with x-api-key; key never sent to frontend)
```

- **This backend** = single entry point for the frontend. It:
  - Serves **native** endpoints (chains, tokens, balances, ENS, rates, Moolre, health).
  - **Proxies** Core flows (quotes, orders, Paystack, offramp, transactions, requests, claims) under `/api/klyra/*`.
- **Core** = live system (pricing engine, liquidity, Paystack, request/claim). Never called directly by the frontend; only by this backend with `x-api-key`.
- The **E2E test files** (`integrations/core-test.ts`, `integrations/core-test-2.ts`) call Core directly for CLI testing; they are the **reference implementation** of how Core works. In production, the **frontend** performs the same logical steps by calling **this backend**; this backend forwards to Core.

---

## 2. Chains and tokens — two sources

| Use case | Endpoint | Source | When to use |
|----------|----------|--------|-------------|
| **Wallet UI, balance checks, token lists for display** | `GET /api/squid/chains`, `GET /api/squid/tokens`, `GET /api/squid/balances` | Squid Router + local data (`data/chains`, `data/tokens`). Mainnet includes Solana (chainId 101). | Building wallet views, showing balances, picking chains/tokens for generic UI. |
| **Core-supported chains/tokens (onramp, offramp, orders)** | `GET /api/klyra/chains`, `GET /api/klyra/tokens` | **Core** (its supported chains and tokens for quotes/orders). | Before calling quotes or creating orders; use these so the frontend only offers options Core can fulfill. |

- When the **integration doc or Core** refers to “chains” or “tokens” **from Core**, that is `GET /api/klyra/chains` and `GET /api/klyra/tokens` (this backend proxies to Core).
- When you need **broad chain/token data** or **wallet balances**, use `/api/squid/*` (this backend’s native Squid + data layer).

---

## 3. Flows (frontend → this backend → Core)

Base URL for examples: `BASE` (e.g. `http://localhost:3000`). All proxy calls go to `BASE/api/klyra/...`; this backend adds `x-api-key` when talking to Core. Response shapes are those of Core; see `core-api.integration.md` and the E2E tests for full request/response details.

### 3.1 Onramp (buy crypto with fiat)

1. **Quote** — `POST /api/klyra/quotes`  
   Body (Core v1 quotes): `action: "ONRAMP"`, `inputAmount`, `inputCurrency` (fiat, e.g. `GHS`), `outputCurrency` (crypto, e.g. `USDC`), `chain`, optional `inputSide`.  
   Use response (`quoteId`, `input`, `output`, `fees`, `exchangeRate`) to show the user one price and to create the order.

2. **Create order** — `POST /api/klyra/orders`  
   Body: `action: "buy"`, amounts and prices from the quote, `f_provider: "PAYSTACK"`, `t_provider: "KLYRA"`, `toIdentifier` = user’s wallet address, `fromIdentifier` = user email (or phone). Include `quoteId` if available.  
   Response: `data.id` = transaction id.

3. **Initialize Paystack** — `POST /api/klyra/paystack/payments/initialize`  
   Body: `email`, `amount` (subunits or major), `currency`, optional `transaction_id` (from step 2), optional `callback_url`.  
   Response: Paystack auth URL; redirect the user there.

4. **User pays** on Paystack. Paystack sends `charge.success` to **Core** (webhook). Core updates the transaction to COMPLETED and sends crypto from the liquidity pool to `toIdentifier`.

5. **Poll status** — `GET /api/klyra/transactions/:id`  
   Frontend polls until `status: "COMPLETED"` (and optional `cryptoSendTxHash`). Alternatively use Pusher if configured on Core.

**curl (minimal sequence)**

```bash
# 1. Quote
curl -s -X POST "${BASE}/api/klyra/quotes" -H "Content-Type: application/json" \
  -d '{"action":"ONRAMP","inputAmount":"100","inputCurrency":"GHS","outputCurrency":"USDC","chain":"base","inputSide":"from"}'

# 2. Create order (use amounts/rates from quote)
curl -s -X POST "${BASE}/api/klyra/orders" -H "Content-Type: application/json" \
  -d '{"action":"buy","f_amount":100,"t_amount":7.5,"f_price":1,"t_price":13.33,"f_chain":"MOMO","t_chain":"BASE","f_token":"GHS","t_token":"USDC","f_provider":"PAYSTACK","t_provider":"KLYRA","fromIdentifier":"user@example.com","toIdentifier":"0x...","fromType":"EMAIL","toType":"ADDRESS","quoteId":"<quoteId>"}'

# 3. Initialize Paystack (use transaction id from step 2)
curl -s -X POST "${BASE}/api/klyra/paystack/payments/initialize" -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","amount":10000,"currency":"GHS","transaction_id":"<transaction_id>"}'

# 4. Poll transaction
curl -s "${BASE}/api/klyra/transactions/<transaction_id>"
```

---

### 3.2 Offramp (sell crypto for fiat)

1. **Quote** — `POST /api/klyra/quotes`  
   Body: `action: "OFFRAMP"`, crypto as `inputCurrency`, fiat as `outputCurrency`, `chain`, `inputAmount`, optional `inputSide`.

2. **Create order** — `POST /api/klyra/orders`  
   Body: `action: "sell"`, amounts/prices from quote, `fromIdentifier` = user’s wallet address, `toIdentifier` = user email or mobile for payout.  
   Response: `data.id` = transaction id.

3. **Get calldata** — `GET /api/klyra/offramp/calldata?transaction_id=<id>`  
   Response: `toAddress`, `chainId`, `token`, `tokenAddress`, `amount`, `decimals`. Frontend uses this to build and sign the transfer from the user’s wallet to `toAddress`.

4. **User sends tx**; frontend gets `tx_hash` and sends it to this backend.

5. **Confirm** — `POST /api/klyra/offramp/confirm`  
   Body: `{ "transaction_id": "<id>", "tx_hash": "<hash>" }`. Core credits the pool and marks the transaction COMPLETED.

6. **Payout** — `POST /api/klyra/paystack/payouts/request` with `{ "transaction_id": "<id>" }`. Core returns a `code`. Then call `POST /api/klyra/paystack/payouts/execute` with that `code` and recipient details (amount, currency, recipient_type, name, account_number, bank_code if nuban, etc.). Core performs the Paystack transfer.

**curl (minimal sequence)**

```bash
# 1. Quote
curl -s -X POST "${BASE}/api/klyra/quotes" -H "Content-Type: application/json" \
  -d '{"action":"OFFRAMP","inputAmount":"10","inputCurrency":"USDC","outputCurrency":"GHS","chain":"base","inputSide":"from"}'

# 2. Create order
curl -s -X POST "${BASE}/api/klyra/orders" -H "Content-Type: application/json" \
  -d '{"action":"sell","f_amount":10,"t_amount":117,"f_price":11.7,"t_price":1,"f_chain":"BASE","t_chain":"MOMO","f_token":"USDC","t_token":"GHS","f_provider":"KLYRA","t_provider":"PAYSTACK","fromIdentifier":"0x...","toIdentifier":"233541234567","fromType":"ADDRESS","toType":"NUMBER","quoteId":"<quoteId>"}'

# 3. Calldata
curl -s "${BASE}/api/klyra/offramp/calldata?transaction_id=<transaction_id>"

# 4. Confirm (after user sends tx)
curl -s -X POST "${BASE}/api/klyra/offramp/confirm" -H "Content-Type: application/json" \
  -d '{"transaction_id":"<transaction_id>","tx_hash":"0x..."}'

# 5. Payout request then execute
curl -s -X POST "${BASE}/api/klyra/paystack/payouts/request" -H "Content-Type: application/json" \
  -d '{"transaction_id":"<transaction_id>"}'
curl -s -X POST "${BASE}/api/klyra/paystack/payouts/execute" -H "Content-Type: application/json" \
  -d '{"code":"<code>","amount":11700,"currency":"GHS","recipient_type":"mobile_money","name":"User","account_number":"233541234567","bank_code":"MTN"}'
```

---

### 3.3 Request & Claim

- **Request (create)** — `POST /api/klyra/requests` with body (e.g. `payerEmail`, `t_amount`, `t_chain`, `t_token`, `toIdentifier`, `receiveSummary`, optional `payoutTarget`, etc.). Core returns request/transaction details and pay link. Same flow as in `integrations/core-test.ts`.
- **Request (resolve pay link)** — `GET /api/klyra/requests/by-link/:linkId` returns request details (and transaction) so the payer can see amount and pay.
- **Request (pay with crypto)** — Get send instructions: `GET /api/klyra/requests/calldata?transaction_id=<id>`. After the user sends the tx, confirm: `POST /api/klyra/requests/confirm-crypto` with `{ "transaction_id", "tx_hash" }`.
- **Request (pay with fiat)** — Use quote → order → `POST /api/klyra/paystack/payments/initialize` with the request’s transaction id; after payment, verify with `GET /api/klyra/paystack/transactions/verify/:reference` or poll `GET /api/klyra/transactions/:id`.
- **Claim (recipient)**  
  - Get by code: `GET /api/klyra/claims/by-code/:code` — returns claim details and whether OTP is verified.  
  - Verify OTP: `POST /api/klyra/claims/verify-otp` — body `{ "claim_id" or "code", "otp" }`.  
  - Claim: `POST /api/klyra/claims/claim` — body `{ "code", "payout_type": "crypto" | "fiat", "payout_target" }`. Core allows this only after OTP is verified; then marks claim CLAIMED and transaction COMPLETED.

**curl (claim flow)**

```bash
curl -s "${BASE}/api/klyra/claims/by-code/ABC123"
curl -s -X POST "${BASE}/api/klyra/claims/verify-otp" -H "Content-Type: application/json" \
  -d '{"code":"ABC123","otp":"123456"}'
curl -s -X POST "${BASE}/api/klyra/claims/claim" -H "Content-Type: application/json" \
  -d '{"code":"ABC123","payout_type":"crypto","payout_target":"0x..."}'
```

---

## 4. Proxy endpoints reference (/api/klyra/*)

All of these are forwarded to Core with `x-api-key`. Request/response bodies are Core’s; status codes and error shape (`success: false`, `error`, optional `code`) follow Core. See `core-api.integration.md` and the E2E tests for full field definitions.

| Method | This backend path | Proxies to Core | Use |
|--------|-------------------|-----------------|-----|
| GET    | /api/klyra/health | /api/health | Liveness. |
| GET    | /api/klyra/ready | /api/ready | Readiness (DB + Redis). |
| POST   | /api/klyra/quotes | /api/v1/quotes | Single quote (ONRAMP / OFFRAMP / SWAP). |
| POST   | /api/klyra/orders | /webhook/order | Create order/transaction (buy / sell / request / claim). |
| POST   | /api/klyra/paystack/payments/initialize | /api/paystack/payments/initialize | Get Paystack payment URL. |
| GET    | /api/klyra/paystack/transactions/verify/:reference | /api/paystack/transactions/verify/:reference | Verify Paystack payment by reference (after user pays). |
| POST   | /api/klyra/paystack/payouts/request | /api/paystack/payouts/request | Request payout (get code). |
| POST   | /api/klyra/paystack/payouts/execute | /api/paystack/payouts/execute | Execute payout with code and recipient details. |
| GET    | /api/klyra/offramp/calldata | /api/offramp/calldata | Get where/how much to send crypto (query: `transaction_id`). |
| POST   | /api/klyra/offramp/confirm | /api/offramp/confirm | Confirm offramp with `transaction_id` and `tx_hash`. |
| GET    | /api/klyra/transactions/verify-by-hash | /api/transactions/verify-by-hash | Verify on-chain tx by chain and tx_hash (query: `chain`, `tx_hash`). |
| GET    | /api/klyra/transactions/:id | /api/transactions/:id | Transaction status (poll after Paystack or confirm). |
| GET    | /api/klyra/transactions/:id/balance-snapshots | /api/transactions/:id/balance-snapshots | Balance before/after for audit. |
| GET    | /api/klyra/transactions/:id/pnl | /api/transactions/:id/pnl | PnL for sell transactions. |
| GET    | /api/klyra/chains | /api/chains | Core-supported chains (for quotes/orders). |
| GET    | /api/klyra/tokens | /api/tokens | Core-supported tokens (query forwarded). |
| GET    | /api/klyra/countries | /api/countries | Countries/currencies for onramp/offramp. |
| POST   | /api/klyra/requests | /api/requests | Create request (request flow). |
| GET    | /api/klyra/requests/by-link/:linkId | /api/requests/by-link/:linkId | Get request by pay-link id (for payer). |
| GET    | /api/klyra/requests/calldata | /api/requests/calldata | Get send instructions for request (query: `transaction_id`). |
| POST   | /api/klyra/requests/confirm-crypto | /api/requests/confirm-crypto | Confirm request payment with tx_hash. |
| GET    | /api/klyra/requests | /api/requests | List requests (query forwarded). |
| GET    | /api/klyra/requests/:id | /api/requests/:id | Request by ID. |
| GET    | /api/klyra/claims/by-code/:code | /api/claims/by-code/:code | Claim by code (recipient flow). |
| POST   | /api/klyra/claims/verify-otp | /api/claims/verify-otp | Verify OTP for claim. |
| POST   | /api/klyra/claims/claim | /api/claims/claim | Complete claim (crypto or fiat payout). |

---

## 5. Native endpoints (no Core)

This backend serves these without calling Core. They are documented in `API.md` with full request/response and curl.

| Area | Endpoints | Purpose |
|------|-----------|---------|
| Health | GET /api/health | This backend liveness. |
| Squid | GET /api/squid/chains, /api/squid/tokens, /api/squid/balances | Chains/tokens/balances from Squid + local data (wallet UI). |
| Balances | GET /api/balances/multicall | Same behavior as /api/squid/balances. |
| Moolre | POST /api/moolre/validate/momo, validate/bank, sms; GET /api/moolre/banks | Mobile money and bank validation, SMS. |
| ENS | GET /api/ens/name/:address, GET /api/ens/address | ENS/Basename resolution. |
| Rates | POST /api/rates/fiat, POST /api/rates/fonbnk | Fiat conversion and Fonbnk quotes. |

---

## 6. References

| Document | Role |
|----------|------|
| **API.md** | Full request/response and curl for every endpoint (native + proxy list). |
| **integrations/core-intergrate.md** | Proxy integration guide (auth, flows, security). |
| **integrations/core-test.ts** | E2E Request & Claim CLI — reference for request/claim and Paystack flows. |
| **integrations/core-test-2.ts** | E2E Onramp/Offramp CLI — reference for quote → order → Paystack/offramp sequence. |
| **core-api.integration.md** | Core API detail (endpoints, body, validation, errors). |

When in doubt, use the E2E test files as the source of truth for **sequence and payloads**; the frontend should perform the same steps against **this backend** (`/api/klyra/*` and native routes) instead of calling Core directly.
