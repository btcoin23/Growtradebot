import {
  getPdaPoolId,
  LiquidityPoolKeys,
  MARKET_STATE_LAYOUT_V3,
  MarketStateV3,
  SPL_MINT_LAYOUT,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey, KeyedAccountInfo } from "@solana/web3.js";
import {
  RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
  OPENBOOK_PROGRAM_ID,
  RAYDIUM_LIQUIDITY_PROGRAM_ID_CLMM,
} from "./liquidity";
import { MinimalMarketLayoutV3 } from "./market";
import { MintData, MintLayout, TokenAccountLayout } from "./types";
import {
  connection,
  COMMITMENT_LEVEL,
  RPC_WEBSOCKET_ENDPOINT,
  PRIVATE_RPC_ENDPOINT,
  RAYDIUM_AMM_URL,
  private_connection,
  RAYDIUM_CLMM_URL,
} from "../config";
import { OpenMarketService } from "../services/openmarket.service";
import { TokenService } from "../services/token.metadata";
import { RaydiumTokenService } from "../services/raydium.token.service";
import redisClient from "../services/redis";

const solanaConnection = new Connection(PRIVATE_RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
});

export interface MinimalTokenAccountData {
  mint: PublicKey;
  poolKeys?: LiquidityPoolKeys;
  market?: MinimalMarketLayoutV3;
}

const existingLiquidityPools: Set<string> = new Set<string>();
const existingOpenBookMarkets: Set<string> = new Set<string>();

async function initDB(): Promise<void> {
  initAMM();
  initCLMM();
}

async function initAMM(): Promise<void> {
  console.log(" - AMM Pool data fetching is started...");
  const ammRes = await fetch(RAYDIUM_AMM_URL);
  const ammData = await ammRes.json();
  console.log(" - AMM Pool data is fetched successfully...");

  const batchSize = 100; // Adjust this value based on your requirements
  const batches: Array<Array<any>> = [];

  for (let i = 0; i < ammData.length; i += batchSize) {
    batches.push(ammData.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (i: any) => {
        if (
          i.baseMint === NATIVE_MINT.toString() ||
          i.quoteMint === NATIVE_MINT.toString()
        ) {
          if (Number(i.liquidity) > 0) {
            const tokenMint =
              i.baseMint === NATIVE_MINT.toString() ? i.quoteMint : i.baseMint;
            // const tokenMetadata = await TokenService.fetchSimpleMetaData(tokenMint);

            const data = {
              // name: tokenMetadata.name,
              // symbol: tokenMetadata.symbol,
              mint: tokenMint,
              isAmm: true,
              poolId: i.ammId,
              creation_ts: Date.now(),
            };
            await RaydiumTokenService.create(data);
          }
        }
      })
    );
  }

  console.log(" - AMM Pool data is saved to MongoDB successfully...");
}

async function initCLMM(): Promise<void> {
  console.log(" - CLMM Pool data fetching is started...");
  const clmmRes = await fetch(RAYDIUM_CLMM_URL);
  const clmmData = await clmmRes.json();
  console.log(" - CLMM Pool data is fetched successfully...");

  const batchSize = 100; // Adjust this value based on your requirements
  const batches: Array<Array<any>> = [];

  for (let i = 0; i < clmmData.data.length; i += batchSize) {
    batches.push(clmmData.data.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (i: any) => {
        if (
          i.mintA === NATIVE_MINT.toString() ||
          i.mintB === NATIVE_MINT.toString()
        ) {
          if (Number(i.tvl) > 0) {
            const tokenMint =
              i.mintA === NATIVE_MINT.toString() ? i.mintB : i.mintA;
            // const tokenMetadata = await TokenService.fetchSimpleMetaData(tokenMint);

            const data = {
              // name: tokenMetadata.name,
              // symbol: tokenMetadata.symbol,
              mint: tokenMint,
              isAmm: false,
              poolId: i.id,
              creation_ts: Date.now(),
            };
            await RaydiumTokenService.create(data);
          }
        }
      })
    );
  }
  console.log(" - CLMM Pool data is saved to MongoDB successfully...");
}

export async function saveTokenAccount(
  mint: PublicKey,
  accountData: MinimalMarketLayoutV3
) {
  const key = `openmarket_${mint}`;
  const res = await redisClient.get(key);
  if (res === "added") return;
  // const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const tokenAccount = <MinimalTokenAccountData>{
    mint: mint,
    market: <MinimalMarketLayoutV3>{
      bids: accountData.bids,
      asks: accountData.asks,
      eventQueue: accountData.eventQueue,
    },
  };

  await redisClient.set(key, "added");
  await OpenMarketService.create(tokenAccount);
  return tokenAccount;
}

export async function checkMintable(
  vault: PublicKey
): Promise<boolean | undefined> {
  try {
    let { data } = (await solanaConnection.getAccountInfo(vault)) || {};
    if (!data) {
      return;
    }
    const deserialize = MintLayout.decode(data);
    return deserialize.mintAuthorityOption === 0;
  } catch (e) {
    console.debug(e);
    console.error({ mint: vault }, `Failed to check if mint is renounced`);
  }
}

export async function getMintMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<MintData | undefined> {
  try {
    const key = `raymintmeta_${mint}`;
    const res = await redisClient.get(key);
    if (res) {
      return JSON.parse(res) as MintData;
    }
    const mintdata = await connection.getParsedAccountInfo(mint);
    if (!mintdata || !mintdata.value) {
      return;
    }

    const data = mintdata.value.data as MintData;
    await redisClient.set(key, JSON.stringify(data));
    await redisClient.expire(key, 30);
    return data;
  } catch (e) {
    return undefined;
  }
}
export async function getTop10HoldersPercent(
  connection: Connection,
  mint: string,
  supply: number
  // excludeAddress: string
): Promise<number> {
  try {
    const accounts = await connection.getTokenLargestAccounts(
      new PublicKey(mint)
    );
    let sum = 0;
    let counter = 0;
    for (const account of accounts.value) {
      // if (account.address.toBase58() === excludeAddress) continue;
      if (!account.uiAmount) continue;
      if (counter >= 10) break;
      counter++;
      sum += account.uiAmount;
    }
    return sum / supply;
  } catch (e) {
    return 0;
  }
}

export async function processOpenBookMarket(
  updatedAccountInfo: KeyedAccountInfo
) {
  let accountData: MarketStateV3 | undefined;
  try {
    accountData = MARKET_STATE_LAYOUT_V3.decode(
      updatedAccountInfo.accountInfo.data
    );

    // to be competitive, we collect market data before buying the token...
    // if (existingTokenAccounts.has(accountData.baseMint.toString())) {
    //   return;
    // }

    saveTokenAccount(accountData.baseMint, accountData);
  } catch (e) {
    console.debug(e);
    console.error({ mint: accountData?.baseMint }, `Failed to process market`);
  }
}

export const runListener = async () => {
  initDB();
  const runTimestamp = Math.floor(new Date().getTime() / 1000);

  const ammSubscriptionId = solanaConnection.onLogs(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    async ({ logs, err, signature }) => {
      if (err) return;
      if (logs && logs.some((log) => log.includes("initialize2"))) {
        // console.log(`https://solscan.io/tx/${signature}`)
        fetchRaydiumMints(
          signature,
          RAYDIUM_LIQUIDITY_PROGRAM_ID_V4.toBase58(),
          true
        );
      }
    },
    COMMITMENT_LEVEL
  );

  const clmmSubscriptionId = solanaConnection.onLogs(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_CLMM,
    async ({ logs, err, signature }) => {
      if (err) return;
      if (logs && logs.some((log) => log.includes("OpenPositionV2"))) {
        fetchRaydiumMints(
          signature,
          RAYDIUM_LIQUIDITY_PROGRAM_ID_CLMM.toBase58(),
          false
        );
      }
    },
    COMMITMENT_LEVEL
  );

  async function fetchRaydiumMints(
    txId: string,
    instructionName: string,
    isAmm: boolean
  ) {
    try {
      const tx = await connection.getParsedTransaction(txId, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      //@ts-ignore
      const accounts = tx?.transaction.message.instructions.find((ix) => ix.programId.toBase58() === instructionName)?.accounts as PublicKey[];
      if (!accounts) {
        console.log("No accounts found in the transaction.");
        return;
      }
      const poolIdIndex = isAmm ? 4 : 5;
      const tokenAIndex = isAmm ? 8 : 21;
      const tokenBIndex = isAmm ? 9 : 20;

      const poolId = accounts[poolIdIndex];
      const existing = existingLiquidityPools.has(poolId.toString());

      if ((tx?.blockTime && tx?.blockTime < runTimestamp) || existing) return;
      existingLiquidityPools.add(poolId.toString());
      const tokenAaccount =
        accounts[tokenAIndex].toBase58() === NATIVE_MINT.toBase58()
          ? accounts[tokenAIndex]
          : accounts[tokenAIndex];
      const tokenBaccount =
        accounts[tokenBIndex].toBase58() === NATIVE_MINT.toBase58()
          ? accounts[tokenBIndex]
          : accounts[tokenBIndex];
      if (tokenBaccount.toBase58() !== NATIVE_MINT.toBase58()) return;
      const key = `raydium_mint_${poolId.toString()}`;
      const res = await redisClient.get(key);
      if (res === "added") return;

      const displayData = {
        "TxID:": `https://solscan.io/tx/${txId}`,
        "PoolID:": poolId.toBase58(),
        "TokenA:": tokenAaccount.toBase58(),
        "TokenB:": tokenBaccount.toBase58(),
      };

      console.log(` - New ${isAmm ? "AMM" : "CLMM"} Found`);
      console.table(displayData);

      const tokenMetadata = await TokenService.fetchMetadataInfo(tokenAaccount);
      // const mintable = mintOption !== true;
      const data = {
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        mint: tokenAaccount.toBase58(),
        isAmm,
        poolId,
        creation_ts: Date.now(),
      };
      await redisClient.set(key, "added");
      await RaydiumTokenService.create(data);
    } catch (e) {
      console.log("Error fetching transaction:", e);
      return;
    }
  }

  const openBookSubscriptionId = solanaConnection.onProgramAccountChange(
    OPENBOOK_PROGRAM_ID,
    async (updatedAccountInfo) => {
      const key = updatedAccountInfo.accountId.toString();
      const existing = existingOpenBookMarkets.has(key);
      if (!existing) {
        existingOpenBookMarkets.add(key);
        const _ = processOpenBookMarket(updatedAccountInfo);
      }
    },
    COMMITMENT_LEVEL,
    [
      { dataSize: MARKET_STATE_LAYOUT_V3.span },
      {
        memcmp: {
          offset: MARKET_STATE_LAYOUT_V3.offsetOf("quoteMint"),
          bytes: NATIVE_MINT.toBase58(),
        },
      },
    ]
  );

  console.info(`Listening for raydium AMM changes: ${ammSubscriptionId}`);
  console.info(`Listening for raydium CLMM changes: ${clmmSubscriptionId}`);
  console.info(`Listening for open book changes: ${openBookSubscriptionId}`);
  // Here, we need to remove this mint from snipe List
  // in our database
  // ------>
};

// export const getPrice = async (shitTokenAddress: string) => {
//   const response = await fetch(
//     "https://api.raydium.io/v2/main/price"
//   );
//   const tokenPrices = await response.json();
//   const solprice = tokenPrices[shitTokenAddress];
//   // Buy rate
//   const estimateRate = await estimateSwapRate(1, shitTokenAddress, false);
//   if (!estimateRate) return 0;
//   const tokenprice = estimateRate / solprice;
//   return tokenprice;
// };
