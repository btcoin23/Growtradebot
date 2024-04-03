import { Connection, PublicKey } from "@solana/web3.js";

export const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/growtrade";
export const TELEGRAM_BOT_API_TOKEN = process.env.TELEGRAM_BOT_API_TOKEN;
export const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";

export const MAINNET_RPC = process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";
export const COMMITMENT_LEVEL = 'finalized';
export const connection = new Connection(MAINNET_RPC, COMMITMENT_LEVEL);

export const BIRDEYE_API_URL = "https://public-api.birdeye.so";
export const BIRDEYE_API_KEY = process.env.BIRD_EVEY_API || "";
export const REQUEST_HEADER = {
  'accept': 'application/json',
  'x-chain': 'solana',
  'X-API-KEY': BIRDEYE_API_KEY,
};

export const FEE_ADDRESS = "CpryfaBHZqz5gtmKeFGHYciFQLMjTDEB7aPoUVRnHQmk";
export const REFERRAL_ACCOUNT = "HExw4dnFEWwfkVG5VV41oHyLBHCvM33n3DEyYKVohyMy";