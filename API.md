# Klyra Backend API Report

Reference for **frontend integration**, **developer API usage**, and **third-party consumers**.

Base path: `/api`. All API routes are under this prefix. Use `Content-Type: application/json` for JSON bodies. Example base: `BASE=http://localhost:3000` or your deployed backend origin (e.g. `https://api.example.com`).

For **Core integration architecture**, flow sequences (onramp, offramp, request & claim), and the distinction between native vs proxy endpoints, see **API-CORE-FLOW.md**.

---

## Overview

| Item | Details |
|------|--------|
| **Base path** | `/api` |
| **Content-Type** | `application/json` (request and response) |
| **CORS** | Configurable via `CORS` env (comma-separated origins). If set, only those origins allowed. |
| **Allowed methods** | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| **Allowed request headers** | `Content-Type`, `Authorization`, `x-api-key` |

### Tokens and authentication

- **This backend** does **not** require API keys or bearer tokens from the client for any of its own endpoints (health, moolre, ens, rates, squid, balances). Call them without auth.
- **Klyra Core** (under `/api/klyra/*`) is a **server-side proxy**. The backend forwards requests to the Core service and injects `x-api-key` from `CORE_API_KEY`; clients do **not** send or see this key. Pass the same request body/query you would to Core; the backend adds auth.
- If you run middleware later that expects `Authorization` or `x-api-key`, you can send them; they are allowed by CORS. Currently no route in this app validates them.

### Error response shape

Most endpoints use a common error shape:

```json
{
  "success": false,
  "error": "Human-readable message"
}
```

HTTP status codes: `400` (validation), `404` (not found), `500` (server error), `502` (upstream failure), `503` (service unavailable / not configured).

---

## Quick reference – all endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | App root: API name + endpoint list |
| GET | `/api` | Same as root, endpoint list |
| GET | `/api/health` | Backend health (status, uptime) |
| GET | `/api/klyra/health` | Core health (proxied) |
| GET | `/api/klyra/ready` | Core ready (proxied) |
| POST | `/api/klyra/quotes` | Get quote (proxied) |
| POST | `/api/klyra/orders` | Submit order webhook (proxied) |
| POST | `/api/klyra/paystack/payments/initialize` | Paystack init (proxied) |
| POST | `/api/klyra/paystack/payouts/request` | Payout request (proxied) |
| POST | `/api/klyra/paystack/payouts/execute` | Payout execute (proxied) |
| GET | `/api/klyra/offramp/calldata` | Offramp calldata (proxied) |
| POST | `/api/klyra/offramp/confirm` | Offramp confirm (proxied) |
| GET | `/api/klyra/transactions/:id` | Transaction by id (proxied) |
| GET | `/api/klyra/transactions/:id/balance-snapshots` | Balance snapshots (proxied) |
| GET | `/api/klyra/transactions/:id/pnl` | Transaction PnL (proxied) |
| GET | `/api/klyra/chains` | Supported chains (proxied) |
| GET | `/api/klyra/tokens` | Supported tokens (proxied) |
| GET | `/api/klyra/countries` | Countries (proxied) |
| GET | `/api/klyra/requests` | Requests list (proxied) |
| GET | `/api/klyra/requests/:id` | Request by id (proxied) |
| GET | `/api/klyra/claims/by-code/:code` | Claim by code (proxied) |
| POST | `/api/klyra/claims/verify-otp` | Verify OTP (proxied) |
| POST | `/api/klyra/claims/claim` | Claim (proxied) |
| POST | `/api/moolre/validate/momo` | Validate mobile money |
| POST | `/api/moolre/validate/bank` | Validate bank account |
| POST | `/api/moolre/sms` | Send SMS |
| GET | `/api/moolre/banks` | List banks (by country) |
| GET | `/api/ens/name/:address` | Resolve address → ENS name |
| GET | `/api/ens/address` | Resolve ENS name → address |
| POST | `/api/rates/fiat` | Fiat-to-fiat quote |
| POST | `/api/rates/fonbnk` | Fonbnk buy/sell quote |
| GET | `/api/squid/chains` | Squid + local chains |
| GET | `/api/squid/tokens` | Squid + local tokens |
| GET | `/api/squid/balances` | Token balances (Squid + multicall) |
| GET | `/api/balances/multicall` | Token balances (multicall) |

---

## Klyra (Core proxy)

All `/api/klyra/*` routes proxy to the **Core backend**. The backend uses `CORE_BASE_URL` and `CORE_API_KEY`; it does not expose them. If Core is not configured, Klyra proxy responses return `503` with `"Core backend is not configured"`.

**Request:** Send the same HTTP method, path suffix, query, and body you would to Core. Query and body are forwarded as-is (for POST, body is JSON).

**Response:** Status and JSON body from Core are returned. On proxy failure (e.g. network), status `502` and `{ "success": false, "error": "Core request failed: ..." }`.

### GET /api/klyra/health

No query or body. Returns Core health.

### GET /api/klyra/ready

No query or body. Returns Core ready status.

### POST /api/klyra/quotes

**Body (JSON):** Quote request.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | `"ONRAMP"` \| `"OFFRAMP"` \| `"SWAP"` |
| inputAmount | string | Yes | Input amount (decimal string) |
| inputCurrency | string | Yes | Input currency/token |
| outputCurrency | string | Yes | Output currency/token |
| chain | string | Yes | Chain id or identifier |
| inputSide | string | No | `"from"` \| `"to"` |

**Returns:** Core quote response (e.g. `quoteId`, `exchangeRate`, `input`, `output`, `fees`, `expiresAt`).

### POST /api/klyra/orders

**Body (JSON):** Order webhook payload.

| Field | Type | Description |
|-------|------|-------------|
| action | string | `"buy"` \| `"sell"` \| `"request"` \| `"claim"` |
| fromIdentifier / toIdentifier | string \| null | Identity (address, email, number) |
| fromType / toType | string \| null | `"ADDRESS"` \| `"EMAIL"` \| `"NUMBER"` |
| fromUserId / toUserId | string \| null | User ids |
| f_amount, t_amount | number | From/to amounts |
| f_price, t_price | number | From/to prices |
| f_chain, t_chain | string | From/to chain |
| f_token, t_token | string | From/to token |
| f_provider, t_provider | string | e.g. `"NONE"`, `"SQUID"`, `"PAYSTACK"`, `"KLYRA"` |
| providerSessionId, requestId, quoteId, providerPrice | string \| number \| null | Optional |

**Returns:** Core order response.

### POST /api/klyra/paystack/payments/initialize

**Body (JSON):** Paystack initialize.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Payer email |
| amount | number | Yes | Amount |
| currency | string | Yes | Currency code |
| transaction_id | string | No | Klyra transaction id |
| callback_url | string | No | Callback URL |

**Returns:** Core Paystack init response.

### POST /api/klyra/paystack/payouts/request

**Body (JSON):** `{ "transaction_id": string }`.

**Returns:** Core payout request response.

### POST /api/klyra/paystack/payouts/execute

**Body (JSON):** Payout execute payload.

| Field | Type | Description |
|-------|------|-------------|
| code | string | Payout code |
| amount | number | Amount |
| currency | string | Currency |
| recipient_type | string | Recipient type |
| name | string | Recipient name |
| account_number | string | Optional |
| bank_code | string | Optional |

**Returns:** Core payout execute response.

### GET /api/klyra/offramp/calldata

**Query:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| transaction_id | string | No | Transaction id (if required by Core) |

**Returns:** Core offramp calldata.

### POST /api/klyra/offramp/confirm

**Body (JSON):** `{ "transaction_id": string, "tx_hash": string }`.

**Returns:** Core offramp confirm response.

### GET /api/klyra/transactions/:id

**Path:** `id` = transaction id.

**Returns:** Core transaction object (e.g. `id`, `status`, `type`, `cryptoSendTxHash`).

### GET /api/klyra/transactions/:id/balance-snapshots

**Path:** `id` = transaction id.

**Returns:** Core balance snapshots for that transaction.

### GET /api/klyra/transactions/:id/pnl

**Path:** `id` = transaction id.

**Returns:** Core PnL for that transaction.

### GET /api/klyra/chains

No body. Optional query params forwarded to Core (e.g. filters).

**Returns:** Core chains list.

### GET /api/klyra/tokens

**Query:** All query params forwarded to Core (e.g. chain, network).

**Returns:** Core tokens list.

### GET /api/klyra/countries

No query or body. **Returns:** Core countries list.

### GET /api/klyra/requests

**Query:** Params forwarded to Core (e.g. pagination, filters).

**Returns:** Core requests list.

### GET /api/klyra/requests/:id

**Path:** `id` = request id. **Returns:** Core request by id.

### GET /api/klyra/claims/by-code/:code

**Path:** `code` = claim code. **Returns:** Core claim by code.

### POST /api/klyra/claims/verify-otp

**Body (JSON):** `{ "claim_id"?: string, "code"?: string, "otp": string }`.

**Returns:** Core verify-otp response.

### POST /api/klyra/claims/claim

**Body (JSON):** `{ "code": string, "payout_type": "crypto" | "fiat", "payout_target": string }`.

**Returns:** Core claim response.

---

## GET /api/health

Liveness check for this backend (process uptime and timestamp).

**Request:** No body or query parameters.

**Response 200**

| Field     | Type   | Description                |
|-----------|--------|----------------------------|
| status    | string | `"ok"` \| `"degraded"` \| `"error"` |
| timestamp | string | ISO 8601 date-time         |
| uptime    | number | Process uptime in seconds  |

```json
{
  "status": "ok",
  "timestamp": "2025-01-29T12:00:00.000Z",
  "uptime": 123.45
}
```

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/health"
```

---

## Klyra (Core proxy)

All `/api/klyra/*` routes proxy to the Core backend. The backend adds `x-api-key` from `CORE_API_KEY`; request/response bodies are forwarded as-is. See `core-api.integration.md` for Core request/response details.

**Common error response** (4xx/5xx from Core or proxy failure):

```json
{
  "success": false,
  "error": "Error message"
}
```

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/klyra/health | Core liveness |
| GET    | /api/klyra/ready | Core readiness |
| POST   | /api/klyra/quotes | POST body → Core `/api/v1/quotes` |
| POST   | /api/klyra/orders | POST body → Core `/webhook/order` |
| POST   | /api/klyra/paystack/payments/initialize | Paystack init |
| GET    | /api/klyra/paystack/transactions/verify/:reference | Verify Paystack payment by reference |
| POST   | /api/klyra/paystack/payouts/request | Payout request |
| POST   | /api/klyra/paystack/payouts/execute | Payout execute |
| GET    | /api/klyra/offramp/calldata | Query: `transaction_id` |
| POST   | /api/klyra/offramp/confirm | POST body → Core |
| GET    | /api/klyra/transactions/verify-by-hash | Query: `chain`, `tx_hash` |
| GET    | /api/klyra/transactions/:id | Transaction by ID |
| GET    | /api/klyra/transactions/:id/balance-snapshots | Balance snapshots |
| GET    | /api/klyra/transactions/:id/pnl | PnL for transaction |
| GET    | /api/klyra/chains | Core chains |
| GET    | /api/klyra/tokens | Core tokens (query forwarded) |
| GET    | /api/klyra/countries | Core countries |
| POST   | /api/klyra/requests | Create request |
| GET    | /api/klyra/requests/by-link/:linkId | Request by pay-link id |
| GET    | /api/klyra/requests/calldata | Query: `transaction_id` (send instructions) |
| POST   | /api/klyra/requests/confirm-crypto | Confirm request payment (body: `transaction_id`, `tx_hash`) |
| GET    | /api/klyra/requests | Core requests (query forwarded) |
| GET    | /api/klyra/requests/:id | Request by ID |
| GET    | /api/klyra/claims/by-code/:code | Claim by code |
| POST   | /api/klyra/claims/verify-otp | Verify OTP |
| POST   | /api/klyra/claims/claim | Submit claim |

**curl examples**

```bash
# Core health
curl -s "${BASE:-http://localhost:3000}/api/klyra/health"

# Quotes (body from Core API spec)
curl -s -X POST "${BASE:-http://localhost:3000}/api/klyra/quotes" \
  -H "Content-Type: application/json" \
  -d '{"action":"ONRAMP","inputAmount":"100","inputCurrency":"GHS","outputCurrency":"USDC","chain":"base","inputSide":"from"}'

# Transaction by ID
curl -s "${BASE:-http://localhost:3000}/api/klyra/transactions/TRANSACTION_UUID"

# Paystack verify (after user pays)
curl -s "${BASE:-http://localhost:3000}/api/klyra/paystack/transactions/verify/PAYSTACK_REFERENCE"

# Request by pay link / calldata / confirm
curl -s "${BASE:-http://localhost:3000}/api/klyra/requests/by-link/LINK_ID"
curl -s "${BASE:-http://localhost:3000}/api/klyra/requests/calldata?transaction_id=TRANSACTION_ID"
curl -s -X POST "${BASE:-http://localhost:3000}/api/klyra/requests/confirm-crypto" \
  -H "Content-Type: application/json" -d '{"transaction_id":"...","tx_hash":"0x..."}'

# Chains / tokens (query params forwarded to Core)
curl -s "${BASE:-http://localhost:3000}/api/klyra/chains"
curl -s "${BASE:-http://localhost:3000}/api/klyra/tokens?chainId=8453"
```

---

## Moolre

### POST /api/moolre/validate/momo

Validate mobile money account (mobile numbers only).

**Request body**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| receiver | string | Yes      | Mobile number (e.g. `0241234567`) |
| channel  | number | No*      | 1=MTN, 6=Vodafone, 7=AirtelTigo |
| provider | string | No*      | e.g. `"MTN"` (alternative to channel) |
| currency | string | No       | Default `GHS` |

\* One of `channel` or `provider` is required.

**Response 200**

```json
{
  "success": true,
  "accountName": "ACCOUNT HOLDER NAME"
}
```

**Response 400**

```json
{
  "success": false,
  "error": "receiver (mobile number) is required."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Error message"
}
```

**curl**

```bash
curl -s -X POST "${BASE:-http://localhost:3000}/api/moolre/validate/momo" \
  -H "Content-Type: application/json" \
  -d '{"receiver": "0241234567", "channel": 1, "currency": "GHS"}'
```

---

### POST /api/moolre/validate/bank

Validate bank account name.

**Request body**

| Field     | Type   | Required | Description |
|-----------|--------|----------|-------------|
| receiver  | string | Yes      | Account number |
| sublistId | string | Yes      | Bank code from GET /api/moolre/banks |
| currency  | string | No       | Default `GHS` |

**Response 200**

```json
{
  "success": true,
  "accountName": "ACCOUNT HOLDER NAME"
}
```

**Response 400**

```json
{
  "success": false,
  "error": "sublistId (bank code) is required. Use GET /api/moolre/banks to list codes."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Error message"
}
```

**curl**

```bash
curl -s -X POST "${BASE:-http://localhost:3000}/api/moolre/validate/bank" \
  -H "Content-Type: application/json" \
  -d '{"receiver": "1234567890", "sublistId": "300303", "currency": "GHS"}'
```

---

### POST /api/moolre/sms

Send SMS.

**Request body**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| recipient | string | Yes | Phone number |
| message   | string | Yes | SMS body |
| senderId  | string | No  | Sender ID (e.g. `MyApp`) |
| ref       | string | No  | Optional reference (default: generated UUID) |

**Response 200**

```json
{
  "success": true,
  "data": {
    "status": 1,
    "code": "...",
    "message": "...",
    "data": null,
    "go": null
  }
}
```

**Response 400**

```json
{
  "success": false,
  "error": "Recipient and message are required."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "SMS dispatch failed. Please try again later."
}
```

**curl**

```bash
curl -s -X POST "${BASE:-http://localhost:3000}/api/moolre/sms" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "0241234567", "message": "Your verification code is 123456"}'
```

---

### GET /api/moolre/banks

List banks (for bank validation). Query: `?country=gha` or `?country=nga`. Default `gha`.

**Response 200**

```json
{
  "success": true,
  "data": [
    { "code": "300303", "name": "Absa Bank Ghana Limited" },
    { "code": "300329", "name": "Access Bank Limited" }
  ]
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Error message"
}
```

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/moolre/banks"
curl -s "${BASE:-http://localhost:3000}/api/moolre/banks?country=nga"
```

---

## ENS

### GET /api/ens/name/:address

Resolve wallet address to ENS name (and avatar). Tries mainnet ENS, Base basename, then ENSData API.

**Request:** Path parameter `address` — Ethereum address.

**Response 200 (resolved)**

```json
{
  "success": true,
  "ensName": "vitalik.eth",
  "avatar": "https://..."
}
```

**Response 200 (not found)**

```json
{
  "success": true,
  "ensName": null,
  "avatar": null
}
```

**Response 400**

```json
{
  "success": false,
  "error": "Address is required."
}
```
or
```json
{
  "success": false,
  "error": "Invalid Ethereum address."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Failed to resolve ENS name."
}
```

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/ens/name/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

---

### GET /api/ens/address

Resolve ENS name or Basename to wallet address. Query: `?ens-name=vitalik.eth` or `?ensName=vitalik.eth`. Supports .eth, .base, and multi-chain (e.g. `vitalik.eth:btc`).

**Query**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| ens-name  | string | Yes*     | ENS or Basename |
| ensName   | string | Yes*     | Alias for ens-name |

**Response 200 (resolved)**

```json
{
  "success": true,
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "avatar": "https://..."
}
```

**Response 200 (not found)**

```json
{
  "success": true,
  "address": null,
  "avatar": null
}
```

**Response 400**

```json
{
  "success": false,
  "error": "ens-name query is required."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Failed to resolve address."
}
```

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/ens/address?ens-name=vitalik.eth"
```

---

## Rates

### POST /api/rates/fiat

Fiat-to-fiat conversion (ExchangeRate-API). Without `amount` returns 1:1 rate; with `amount` returns conversion for that amount.

**Request body**

| Field  | Type   | Required | Description |
|--------|--------|----------|-------------|
| from   | string | Yes      | Source currency code (e.g. `USD`) |
| to     | string | Yes      | Target currency code (e.g. `GHS`) |
| amount | number | No       | Amount to convert |

**Response 200 (rate only)**

```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "GHS",
    "rate": 15.5,
    "timeLastUpdateUtc": "Fri, 27 Mar 2020 00:00:00 +0000"
  }
}
```

**Response 200 (with amount)**

```json
{
  "success": true,
  "data": {
    "from": "USD",
    "to": "GHS",
    "rate": 15.5,
    "amount": 100,
    "convertedAmount": 1550,
    "timeLastUpdateUtc": "Fri, 27 Mar 2020 00:00:00 +0000"
  }
}
```

**Response 400**

```json
{
  "success": false,
  "error": "from and to currency codes are required (e.g. USD, GHS)."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Error message"
}
```

**curl**

```bash
curl -s -X POST "${BASE:-http://localhost:3000}/api/rates/fiat" \
  -H "Content-Type: application/json" \
  -d '{"from": "USD", "to": "GHS"}'
curl -s -X POST "${BASE:-http://localhost:3000}/api/rates/fiat" \
  -H "Content-Type: application/json" \
  -d '{"from": "USD", "to": "GHS", "amount": 100}'
```

---

### POST /api/rates/fonbnk

Fonbnk quote. Quotes update every 30 seconds; poll as needed.

**Request body**

| Field          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| country        | string | Yes      | Country code (e.g. `GH`) |
| token          | string | Yes      | Token (e.g. `USDC`, `BASE_USDC`) |
| purchaseMethod | string | Yes      | `"buy"` \| `"sell"` |
| amount         | number | Yes      | Fiat or crypto amount |
| amountIn       | string | No       | `"fiat"` \| `"crypto"` (default `"fiat"`) |

- **Buy, amount in fiat:** `amount` = fiat, response `total` = crypto received.
- **Buy, amount in crypto:** `amountIn: "crypto"`, `amount` = crypto, response `total` = fiat equivalent.
- **Sell:** `amount` = crypto, response `total` = fiat.

**Response 200 (buy, amount in fiat)**

```json
{
  "success": true,
  "data": {
    "country": "GH",
    "currency": "GHS",
    "network": "base",
    "asset": "USDC",
    "amount": 100,
    "rate": 12.74,
    "fee": 0,
    "total": 7.85,
    "paymentChannel": "mobile_money",
    "purchaseMethod": "buy",
    "amountIn": "fiat"
  }
}
```

**Response 200 (buy, amount in crypto)**

```json
{
  "success": true,
  "data": {
    "country": "GH",
    "currency": "GHS",
    "network": "base",
    "asset": "USDC",
    "amount": 10,
    "rate": 11.735,
    "fee": 0,
    "total": 117.35,
    "paymentChannel": "mobile_money",
    "purchaseMethod": "buy",
    "amountIn": "crypto"
  }
}
```

**Response 400**

```json
{
  "success": false,
  "error": "country is required (e.g. GH for Ghana)."
}
```

**Response 404**

```json
{
  "success": false,
  "error": "No quote returned from Fonbnk for this request."
}
```

**Response 500**

```json
{
  "success": false,
  "error": "Fonbnk quote failed."
}
```

**curl**

```bash
curl -s -X POST "${BASE:-http://localhost:3000}/api/rates/fonbnk" \
  -H "Content-Type: application/json" \
  -d '{"country": "GH", "token": "USDC", "purchaseMethod": "buy", "amount": 100}'
```

---

## Squid & Balances

Chains and tokens combine [Squid Router](https://docs.squidrouter.com) with local data: `data/chains/mainnet.chains.json`, `data/chains/testnet.chains.json`, and `data/tokens/` (mainnet includes Solana chainId 101; testnet from `testnet.tokens.json`). Balances use viem multicall (EVM only). Requires `SQUID_INTEGRATOR_ID` in the environment.

---

### GET /api/squid/chains

Supported chains (Squid + data/chains). Mainnet includes Solana (chainId 101).

**Query**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| testnet   | string | No       | `"1"` or `"true"` for testnet-only |
| all       | string | No       | `"1"` or `"true"` for mainnet + testnet combined |

**Response 200**

Array of chain objects. Each item:

| Field         | Type   | Description |
|---------------|--------|-------------|
| chainId       | string | Chain ID    |
| networkName   | string | Display name |
| chainIconURI  | string | Icon URL (optional) |
| rpc           | string | Single RPC URL (optional) |
| rpcs          | string[] | Multiple RPC URLs (optional) |
| explorer      | object | `name`, `url`, `apiUrl` (optional) |

```json
[
  {
    "chainId": "1",
    "networkName": "Ethereum",
    "chainIconURI": "https://..."
  }
]
```

**Response 503**

```json
{
  "success": false,
  "error": "SQUID_INTEGRATOR_ID is not configured."
}
```

(Or other fetch/configuration error message.)

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/squid/chains"
curl -s "${BASE:-http://localhost:3000}/api/squid/chains?testnet=true"
curl -s "${BASE:-http://localhost:3000}/api/squid/chains?all=true"
```

---

### GET /api/squid/tokens

Supported tokens (Squid + Solana mainnet + testnet from `testnet.tokens.json`). Mainnet includes Solana (chainId 101) tokens.

**Query**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| testnet   | string | No       | `"1"` or `"true"` for testnet-only |
| all       | string | No       | `"1"` or `"true"` for mainnet + testnet combined |

**Response 200**

Array of token objects. Each item:

| Field        | Type   | Description |
|--------------|--------|-------------|
| chainId      | string | Chain ID    |
| networkName  | string | Chain display name |
| chainIconURI | string | Chain icon URL (optional) |
| address      | string | Token contract address |
| symbol       | string | Token symbol |
| decimals     | number | Token decimals |
| name         | string | Token name (optional) |
| logoURI      | string | Token logo URL (optional) |
| rpc / rpcs   | string \| string[] | Chain RPC (optional) |

```json
[
  {
    "chainId": "1",
    "networkName": "Ethereum",
    "chainIconURI": "https://...",
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "symbol": "USDC",
    "decimals": 6,
    "name": "USD Coin",
    "logoURI": "https://..."
  }
]
```

**Response 503**

```json
{
  "success": false,
  "error": "SQUID_INTEGRATOR_ID is not configured."
}
```

(Or other fetch/configuration error message.)

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/squid/tokens"
curl -s "${BASE:-http://localhost:3000}/api/squid/tokens?testnet=true"
curl -s "${BASE:-http://localhost:3000}/api/squid/tokens?all=true"
```

---

### GET /api/squid/balances

Token balances for a wallet (Squid-backed chains/tokens, viem multicall). Sorted by balance (highest first). Response includes `x-squid-network: testnet` or `mainnet` when applicable.

**Query**

| Parameter    | Type   | Required | Description |
|-------------|--------|----------|-------------|
| address     | string | Yes      | Wallet address (e.g. `0x...`) |
| chainId     | string | No       | Limit to one chain |
| tokenAddress| string | No       | Limit to one token across chains |
| testnet     | string | No       | `"1"` or `"true"` for testnet |

**Response 200**

| Field          | Type   | Description |
|----------------|--------|-------------|
| success        | boolean | `true` |
| data           | array  | Balance items (see below) |

Each balance item:

| Field          | Type   | Description |
|----------------|--------|-------------|
| chainId        | string | Chain ID |
| networkName    | string | Chain display name |
| chainIconURI   | string | Chain icon URL (optional) |
| tokenAddress   | string | Token contract address |
| tokenSymbol    | string | Token symbol |
| tokenDecimals  | number | Token decimals |
| tokenName      | string | Token name (optional) |
| tokenLogoURI   | string | Token logo URL (optional) |
| balance        | string | Human-readable balance |
| balanceRaw     | string | Raw units (e.g. wei/smallest unit) |

```json
{
  "success": true,
  "data": [
    {
      "chainId": "1",
      "networkName": "Ethereum",
      "chainIconURI": "https://...",
      "tokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "tokenSymbol": "USDC",
      "tokenDecimals": 6,
      "tokenName": "USD Coin",
      "tokenLogoURI": "https://...",
      "balance": "100.5",
      "balanceRaw": "100500000"
    }
  ]
}
```

**Response 400**

```json
{
  "success": false,
  "error": "address is required (wallet address)."
}
```

**Response 502**

```json
{
  "success": false,
  "error": "Failed to fetch balances."
}
```

**curl**

```bash
curl -s "${BASE:-http://localhost:3000}/api/squid/balances?address=0x9f08eFb0767Bf180B8b8094FaaEF9DAB5a0755e1"
curl -s "${BASE:-http://localhost:3000}/api/squid/balances?address=0x9f08eFb0767Bf180B8b8094FaaEF9DAB5a0755e1&testnet=true"
curl -s "${BASE:-http://localhost:3000}/api/squid/balances?address=0x...&chainId=8453"
curl -s "${BASE:-http://localhost:3000}/api/squid/balances?address=0x...&tokenAddress=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
```

---

### GET /api/balances/multicall

Same behavior and response shape as `/api/squid/balances`: token balances via viem multicall, sorted by balance (highest first), with chain and token metadata.

**Query**

| Parameter    | Type   | Required | Description |
|-------------|--------|----------|-------------|
| address     | string | Yes      | Wallet address (e.g. `0x...`) |
| chainId     | string | No       | Limit to one chain |
| tokenAddress| string | No       | Limit to one token across chains |
| testnet     | string | No       | `"1"` or `"true"` for testnet |

**Response 200**

Same as GET /api/squid/balances: `{ "success": true, "data": [ ... ] }` with same balance item shape.

**Response 400**

```json
{
  "success": false,
  "error": "address is required (wallet address)."
}
```

**Response 502**

```json
{
  "success": false,
  "error": "Failed to fetch multicall balances."
}
```

---

## Environment and configuration (for deployers)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (1–65535). |
| `CORS` | No | Comma-separated allowed origins. Empty = allow all. |
| `CORE_BASE_URL` | For Klyra | Core API base URL (no trailing slash). |
| `CORE_API_KEY` | For Klyra | API key sent as `x-api-key` to Core. |
| `SQUID_INTEGRATOR_ID` | For Squid/balances | Squid Router integrator id (chains, tokens, balances). |
| `EXCHANGERATE_API_KEY` | For /api/rates/fiat | ExchangeRate-API key. |
| Moolre credentials | For Moolre | Set per Moolre docs (validate, SMS, banks). |
| Fonbnk | For /api/rates/fonbnk | Configured in fonbnk service. |

If Core is not set, all `/api/klyra/*` return 503. If Squid is not set, `/api/squid/*` and balance endpoints return 503 or 502. Other endpoints may return 500 when their upstream (Moolre, ExchangeRate, Fonbnk) is missing or fails.

