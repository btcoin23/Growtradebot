import { Connection, PublicKey } from "@solana/web3.js";

export const MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/growtrade";
export const TELEGRAM_BOT_API_TOKEN = process.env.TELEGRAM_BOT_API_TOKEN;
export const RESERVE_KEY = process.env.RESERVE_KEY || "";
if (RESERVE_KEY === "") {
  throw new Error("Missing RESERVE_KEY");
}
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

export const RESERVE_WALLET = "HFHHBkQdXoFxUAgQkdGZnLThPV5KvHkZx36WEeZntE9X";
export const REFERRAL_ACCOUNT = "DgzkEQqczAZCrUeq52cMbfKgx3mSHUon7wtiVuivs7Q7";

export const MIN = 60;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const WK = 7 * DAY;

export const JUPITER_PROJECT = new PublicKey(
  "45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp",
);