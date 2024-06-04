import {
  ApiClmmPoolsItem,
  jsonInfo2PoolKeys,
  Clmm,
  MAINNET_PROGRAM_ID,
  Liquidity,
  LIQUIDITY_STATE_LAYOUT_V4,
  LiquidityPoolKeys,
  LiquidityStateV4,
  MARKET_STATE_LAYOUT_V3,
  MarketStateV3,
  Percent,
  PoolInfoLayout,
  Token,
  TOKEN_PROGRAM_ID,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import {
  Keypair,
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  KeyedAccountInfo,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getTokenAccounts,
  RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
  OPENBOOK_PROGRAM_ID,
  createPoolKeys,
  convertDBForPoolStateV4,
  RAYDIUM_LIQUIDITY_PROGRAM_ID_CLMM,
} from "./liquidity";
import {
  convertDBForMarketV3,
  getMinimalMarketV3,
  MinimalMarketLayoutV3,
} from "./market";
import { MintData, MintLayout, TokenAccountLayout } from "./types";
import bs58 from "bs58";
import {
  connection,
  COMMITMENT_LEVEL,
  RPC_WEBSOCKET_ENDPOINT,
  PRIVATE_RPC_ENDPOINT,
} from "../config";
import { OpenMarketService } from "../services/openmarket.service";
import { TokenService } from "../services/token.metadata";
import { RaydiumTokenService } from "../services/raydium.token.service";
import redisClient from "../services/redis";

import { formatClmmKeysById } from "./utils/formatClmmKeysById";
import { formatAmmKeysById } from "./utils/formatAmmKeysById";

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
// const existingTokenAccounts: Map<string, MinimalTokenAccountData> = new Map<string, MinimalTokenAccountData>();

// let wallet: Keypair;
let quoteToken: Token;
// let quoteTokenAssociatedAddress: PublicKey;
// let quoteAmount: TokenAmount;
let quoteMinPoolSizeAmount: TokenAmount;

async function init(): Promise<void> {
  quoteToken = Token.WSOL;
  // quoteAmount = new TokenAmount(Token.WSOL, 0.01, false);
  quoteMinPoolSizeAmount = new TokenAmount(quoteToken, 0.1, false);
  // get wallet
  // wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));

  // // get quote mint and amount
  // switch (QUOTE_MINT) {
  //   case 'WSOL': {
  //     quoteToken = Token.WSOL;
  //     quoteAmount = new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false);
  //     quoteMinPoolSizeAmount = new TokenAmount(quoteToken, MIN_POOL_SIZE, false);
  //     break;
  //   }
  //   case 'USDC': {
  //     quoteToken = new Token(
  //       TOKEN_PROGRAM_ID,
  //       new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  //       6,
  //       'USDC',
  //       'USDC',
  //     );
  //     quoteAmount = new TokenAmount(quoteToken, QUOTE_AMOUNT, false);
  //     quoteMinPoolSizeAmount = new TokenAmount(quoteToken, MIN_POOL_SIZE, false);
  //     break;
  //   }
  //   default: {
  //     throw new Error(`Unsupported quote mint "${QUOTE_MINT}". Supported values are USDC and WSOL`);
  //   }
  // }

  // console.log(`Snipe list: ${USE_SNIPE_LIST}`);
  // console.log(`Check mint renounced: ${CHECK_IF_MINT_IS_RENOUNCED}`);
  // console.log(
  //   `Min pool size: ${quoteMinPoolSizeAmount.isZero() ? 'false' : quoteMinPoolSizeAmount.toFixed()} ${quoteToken.symbol}`,
  // );
  // console.log(`Buy amount: ${quoteAmount.toFixed()} ${quoteToken.symbol}`);
  // console.log(`Auto sell: ${AUTO_SELL}`);
  // console.log(`Sell delay: ${AUTO_SELL_DELAY === 0 ? 'false' : AUTO_SELL_DELAY}`);

  // check existing wallet for associated token account of quote mint
  // const tokenAccounts = await getTokenAccounts(solanaConnection, wallet.publicKey, COMMITMENT_LEVEL);

  // for (const ta of tokenAccounts) {
  //   existingTokenAccounts.set(ta.accountInfo.mint.toString(), <MinimalTokenAccountData>{
  //     mint: ta.accountInfo.mint,
  //     address: ta.pubkey,
  //   });
  // }

  // const tokenAccount = tokenAccounts.find((acc) => acc.accountInfo.mint.toString() === NATIVE_MINT.toString())!;

  // if (!tokenAccount) {
  //   throw new Error(`No ${quoteToken.symbol} token account found in wallet: ${wallet.publicKey}`);
  // }

  // quoteTokenAssociatedAddress = tokenAccount.pubkey;
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
  await init();
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

      const tokenMetadata = await TokenService.fetchMetadataInfo(tokenAaccount);
      const displayData = {
        "TxID:": `https://solscan.io/tx/${txId}`,
        "PoolID:": poolId.toBase58(),
        "TokenA:": tokenAaccount.toBase58(),
        "TokenB:": tokenBaccount.toBase58(),
      };

      console.log(` - New ${isAmm ? "AMM" : "CLMM"} Found`);
      console.table(displayData);

      // const mintable = mintOption !== true;
      const data = {
        name: tokenMetadata.tokenName,
        symbol: tokenMetadata.tokenSymbol,
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
