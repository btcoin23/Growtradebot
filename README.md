# Telegram Solana Bot (Raydium, Jupiter, Pump.fun)
## Features

- Track All tokens, All Pools on Raydium(AMM, CLMM), Jupiter, Pump.fun 
- Buy and sell all SPL tokens using JITO on Raydium, Jupiter, Pump.fun
- Auto-but/sell according to the user setting
- PNL Card generation
- Provide a security by creating new GT wallet, not requires user wallet private key

## Tech stack
- Typescript
- Telegram API
- Solana/web3
- Raydium SDK
- Jupiter API
- Pump.fun
- JITO
- MongoDB
- Redis

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js installed (v18 or above recommended)
- Telegram bot token from bot father
- MongoDB Cluster URI
- Redis URI

## Configurations

Create a new `.env` file and add your Private key, Rpc URL

`.env` file
```

MONGODB_URL=
REDIS_URI=

# Local
GROWTRADE_BOT_ID=
GROWSOL_ALERT_BOT_ID=
BridgeBotID=
ALERT_BOT_API_TOKEN=
TELEGRAM_BOT_API_TOKEN=

MAINNET_RPC=
PRIVATE_RPC_ENDPOINT=
RPC_WEBSOCKET_ENDPOINT=

JITO_UUID=

BIRD_EVEY_API=

GROWSOL_API_ENDPOINT=

PNL_IMG_GENERATOR_API=

```

Then run

```sh
npm run serve
```

![6](https://github.com/btcoin23/Growtradebot/assets/138183918/351d8203-6f4d-4560-8b70-cecf0468ad9a)
![z](https://github.com/btcoin23/Growtradebot/assets/138183918/20e824c4-82ab-4774-a4b3-5434d4cf925f)


## Version 1.0,   21/6/2024
