# API

Base path: `/api`.

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

Chains and tokens come from [Squid Router](https://docs.squidrouter.com). Balances are computed via viem multicall (EVM only). Requires `SQUID_INTEGRATOR_ID` in the environment.

---

## GET /api/squid/chains

Return supported chains (relevant fields only: chainId, networkName, chainIconURI).

**Query**

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| testnet   | string | No       | `"1"` or `"true"` for testnet chains |

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

Return supported tokens with chain info (chainId, networkName, chainIconURI, address, symbol, decimals, name, logoURI).

**Query**

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| testnet   | string | No       | `"1"` or `"true"` for testnet tokens  |

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

