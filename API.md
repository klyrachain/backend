# Klyra Backend API Report

Reference for **frontend integration**, **developer API usage**, and **third-party consumers**.  
Base URL: your backend origin (e.g. `https://api.example.com`). All API routes are under `/api`.

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

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2025-01-29T12:00:00.000Z",
  "uptime": 123.45
}
```

---

## POST /api/moolre/validate/momo

Validate mobile money account name (mobile numbers only).

**Request**

```json
{
  "receiver": "0241234567",
  "channel": 1,
  "currency": "GHS"
}
```

Or with provider name instead of channel:

```json
{
  "receiver": "0241234567",
  "provider": "MTN",
  "currency": "GHS"
}
```

`channel`: 1=MTN, 6=Vodafone, 7=AirtelTigo. `currency` optional, default GHS.

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

---

## POST /api/moolre/validate/bank

Validate bank account name.

**Request**

```json
{
  "receiver": "1234567890",
  "sublistId": "300303",
  "currency": "GHS"
}
```

`sublistId` is the bank code from GET /api/moolre/banks. `currency` optional, default GHS.

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

---

## POST /api/moolre/sms

**Request**

```json
{
  "recipient": "0241234567",
  "message": "Your verification code is 123456",
  "senderId": "MyApp",
  "ref": "optional-ref"
}
```

`senderId` and `ref` optional. `ref` defaults to generated UUID.

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

---

## GET /api/moolre/banks

Query: `?country=gha` or `?country=nga`. Default gha.

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

---

## GET /api/ens/name/:address

Resolve a wallet address to ENS name (and avatar when available). Tries mainnet ENS, Base basename, then ENSData API.

**Response 200**

```json
{
  "success": true,
  "ensName": "vitalik.eth",
  "avatar": "https://..."
}
```

When no name is found:

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

---

## GET /api/ens/address

Resolve an ENS name (or Basename) to wallet address (and avatar when available). Query: `?ens-name=vitalik.eth` or `?ensName=vitalik.eth`. Supports .eth, .base, and multi-chain format (e.g. `vitalik.eth:btc`).

**Response 200**

```json
{
  "success": true,
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "avatar": "https://..."
}
```

When no address is found:

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

---

## POST /api/rates/fiat

Fiat-to-fiat conversion via ExchangeRate-API. Body: from, to (currency codes), optional amount. Without amount returns 1:1 rate; with amount returns conversion for that amount.

**Request**

```json
{
  "from": "USD",
  "to": "GHS"
}
```

With amount:

```json
{
  "from": "USD",
  "to": "GHS",
  "amount": 100
}
```

**Response 200**

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

With amount:

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

---

## POST /api/rates/fonbnk

Fetch quote from Fonbnk. Body: country, token, purchaseMethod (buy | sell), optional amount, optional amountIn ("fiat" | "crypto", default "fiat"). amountIn "crypto" = pass crypto amount and get fiat equivalent (both buy and sell). Quotes update every 30 seconds; poll as needed.

**Request (buy, amount in fiat: how much crypto for 100 GHS?)**

```json
{
  "country": "GH",
  "token": "USDC",
  "purchaseMethod": "buy",
  "amount": 100
}
```

**Request (buy, amount in crypto: how much fiat to pay for 10 USDC?)**

```json
{
  "country": "GH",
  "token": "BASE_USDC",
  "purchaseMethod": "buy",
  "amount": 10,
  "amountIn": "crypto"
}
```

**Request (sell: how much fiat for 10 USDC?)**

```json
{
  "country": "GH",
  "token": "BASE_USDC",
  "purchaseMethod": "sell",
  "amount": 10
}
```

**Response 200 (amountIn fiat: amount = fiat input, total = crypto received)**

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

**Response 200 (amountIn crypto: amount = crypto input, total = fiat equivalent)**

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

---

## Squid & Balances

Chains and tokens combine [Squid Router](https://docs.squidrouter.com) with local data: `data/chains/mainnet.chains.json`, `data/chains/testnet.chains.json`, and `data/tokens/` (Solana mainnet from `solana.json`, testnet from `testnet.tokens.json`). Mainnet includes Solana (chainId 101). Balances are computed via viem multicall (EVM only). Requires `SQUID_INTEGRATOR_ID` in the environment.

---

## GET /api/squid/chains

Return supported chains (Squid + data/chains). Mainnet includes Solana (chainId 101).

**Query**

| Parameter | Type   | Required | Description                                                           |
|-----------|--------|----------|-----------------------------------------------------------------------|
| testnet   | string | No       | `"1"` or `"true"` for testnet-only chains                             |
| all       | string | No       | `"1"` or `"true"` for mainnet + testnet combined (whole lot)          |

**Response 200**

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

---

## GET /api/squid/tokens

Return supported tokens (Squid + Solana mainnet from `solana.json`; testnet from `testnet.tokens.json`). Mainnet includes all Solana (chainId 101) tokens.

**Query**

| Parameter | Type   | Required | Description                                                           |
|-----------|--------|----------|-----------------------------------------------------------------------|
| testnet   | string | No       | `"1"` or `"true"` for testnet-only tokens                             |
| all       | string | No       | `"1"` or `"true"` for mainnet + testnet combined (whole list)         |

**Response 200**

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

---

## GET /api/squid/balances

Return token balances for a wallet (Squid-backed chains/tokens, viem multicall). Sorted by balance (highest first). Each item includes chain and token metadata (networkName, chainIconURI, tokenSymbol, tokenLogoURI, etc.).

**Query**

| Parameter    | Type   | Required | Description                                           |
|--------------|--------|----------|-------------------------------------------------------|
| address      | string | Yes      | Wallet address (e.g. `0x...`)                         |
| chainId      | string | No       | Limit to one chain                                    |
| tokenAddress | string | No       | Limit to one token across chains                      |
| testnet      | string | No       | `"1"` or `"true"` for testnet                         |

**Examples**

- Full wallet: `GET /api/squid/balances?address=0x...`
- One chain: `GET /api/squid/balances?address=0x...&chainId=1`
- One token (all chains): `GET /api/squid/balances?address=0x...&tokenAddress=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- One token, one chain: `GET /api/squid/balances?address=0x...&chainId=1&tokenAddress=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

**Response 200**

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

---

## GET /api/balances/multicall

Same as `/api/squid/balances` in behaviour and response shape: token balances via viem multicall, sorted by balance (highest first), with chain and token metadata.

**Query**

| Parameter    | Type   | Required | Description                                           |
|--------------|--------|----------|-------------------------------------------------------|
| address      | string | Yes      | Wallet address (e.g. `0x...`)                         |
| chainId      | string | No       | Limit to one chain                                    |
| tokenAddress | string | No       | Limit to one token across chains                      |
| testnet      | string | No       | `"1"` or `"true"` for testnet                         |

**Examples**

- Full wallet: `GET /api/balances/multicall?address=0x...`
- One chain: `GET /api/balances/multicall?address=0x...&chainId=1`
- One token (all chains): `GET /api/balances/multicall?address=0x...&tokenAddress=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- One token, one chain: `GET /api/balances/multicall?address=0x...&chainId=1&tokenAddress=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

**Response 200**

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

