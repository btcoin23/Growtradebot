import { Commitment, Connection, PublicKey } from "@solana/web3.js";

export const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/growtrade";
export const TELEGRAM_BOT_API_TOKEN = process.env.TELEGRAM_BOT_API_TOKEN;
export const ALERT_BOT_TOKEN_SECRET = process.env.ALERT_BOT_API_TOKEN;
export const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";

export const MAINNET_RPC = process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";
export const RPC_WEBSOCKET_ENDPOINT = process.env.RPC_WEBSOCKET_ENDPOINT || "ws://api.mainnet-beta.solana.com";
export const PRIVATE_RPC_ENDPOINT = process.env.PRIVATE_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";

export const COMMITMENT_LEVEL = 'finalized' as Commitment;
export const connection = new Connection(MAINNET_RPC, COMMITMENT_LEVEL);
export const private_connection = new Connection(PRIVATE_RPC_ENDPOINT, COMMITMENT_LEVEL);

export const RESERVE_WALLET = new PublicKey("B474hx9ktA2pq48ctLm9QXJpfitg59AWwMEQRn7YhyB7");
export const BIRDEYE_API_URL = "https://public-api.birdeye.so";
export const BIRDEYE_API_KEY = process.env.BIRD_EVEY_API || "";
export const JITO_UUID = process.env.JITO_UUID || "";
export const REQUEST_HEADER = {
  'accept': 'application/json',
  'x-chain': 'solana',
  'X-API-KEY': BIRDEYE_API_KEY,
};

export const REFERRAL_ACCOUNT = "DgzkEQqczAZCrUeq52cMbfKgx3mSHUon7wtiVuivs7Q7";

export const MIN = 60;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const WK = 7 * DAY;

export const JUPITER_PROJECT = new PublicKey(
  "45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp",
);


export const MAX_WALLET = 5;
export const GrowTradeVersion = '| Beta Version';

export const GROWSOL_API_ENDPOINT = process.env.GROWSOL_API_ENDPOINT || "http://127.0.0.1:5001";

export const PNL_SHOW_THRESHOLD_USD = 0;
export const RAYDIUM_PASS_TIME = 5 * 24 * 60 * 60 * 1000; // 3days * 24h * 60mins * 60 seconds * 1000 millisecons
export const RAYDIUM_AMM_URL = 'https://api.raydium.io/v2/main/pairs'
export const RAYDIUM_CLMM_URL = 'https://api.raydium.io/v2/ammV3/ammPools'