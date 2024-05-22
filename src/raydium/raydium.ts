import {
  BigNumberish,
  Liquidity,
  LIQUIDITY_STATE_LAYOUT_V4,
  LiquidityPoolKeys,
  LiquidityStateV4,
  MARKET_STATE_LAYOUT_V3,
  MarketStateV3,
  Percent,
  Token,
  TOKEN_PROGRAM_ID,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from '@solana/spl-token';
import {
  Keypair,
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  KeyedAccountInfo,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { getTokenAccounts, RAYDIUM_LIQUIDITY_PROGRAM_ID_V4, OPENBOOK_PROGRAM_ID, createPoolKeys, convertDBForPoolStateV4 } from './liquidity';
import { convertDBForMarketV3, getMinimalMarketV3, MinimalMarketLayoutV3 } from './market';
import { MintData, MintLayout, TokenAccountLayout } from './types';
import bs58 from 'bs58';
import {
  connection,
  COMMITMENT_LEVEL,
  RPC_WEBSOCKET_ENDPOINT,
  PRIVATE_RPC_ENDPOINT,
} from '../config';
import { OpenMarketService } from '../services/openmarket.service';
import { TokenService } from '../services/token.metadata';
import { RaydiumTokenService } from '../services/raydium.token.service';
import redisClient from '../services/redis';

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

export async function saveTokenAccount(mint: PublicKey, accountData: MinimalMarketLayoutV3) {
  const key = `openmarket_${mint}`;
  const res = await redisClient.get(key);
  if (res === 'added') return;
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

export async function processRaydiumPool(id: PublicKey, poolState: LiquidityStateV4) {
  const key = `raydium_mint_${id}`;
  const res = await redisClient.get(key);
  if (res === "added") return;

  if (!quoteMinPoolSizeAmount.isZero()) {
    const poolSize = new TokenAmount(quoteToken, poolState.swapQuoteInAmount, true);
    console.info(`Processing pool: ${id.toString()} with ${poolSize.toFixed()} ${quoteToken.symbol} in liquidity`);

    if (poolSize.lt(quoteMinPoolSizeAmount)) {
      console.warn(
        {
          mint: poolState.baseMint,
          pooled: `${poolSize.toFixed()} ${quoteToken.symbol}`,
        },
        `Skipping pool, smaller than ${quoteMinPoolSizeAmount.toFixed()} ${quoteToken.symbol}`,
        `Swap quote in amount: ${poolSize.toFixed()}`,
      );
      return;
    }
  }

  // const mintOption = await checkMintable(poolState.baseMint);

  // if (mintOption !== true) {
  //   console.warn({ mint: poolState.baseMint }, 'Skipping, owner can mint tokens!');
  //   // ---- Mintable Check
  // }
  console.log("New Pool Created", id);
  const tokenMetadata = await TokenService.fetchMetadataInfo(poolState.baseMint);
  // const mintable = mintOption !== true;

  const data = {
    name: tokenMetadata.tokenName,
    symbol: tokenMetadata.tokenSymbol,
    mint: poolState.baseMint,
    poolId: id,
    poolState,
    creation_ts: Date.now()
  }
  await redisClient.set(key, "added");
  await RaydiumTokenService.create(data);
  // await buy(id, poolState);
}

export async function checkMintable(vault: PublicKey): Promise<boolean | undefined> {
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

export async function getMintMetadata(connection: Connection, mint: PublicKey): Promise<MintData | undefined> {
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
  supply: number,
  excludeAddress: string,
): Promise<number> {
  try {
    const accounts = await connection.getTokenLargestAccounts(new PublicKey(mint));
    let sum = 0;
    let counter = 0;
    for (const account of accounts.value) {
      if (account.address.toBase58() === excludeAddress) continue;
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

export async function processOpenBookMarket(updatedAccountInfo: KeyedAccountInfo) {
  let accountData: MarketStateV3 | undefined;
  try {
    accountData = MARKET_STATE_LAYOUT_V3.decode(updatedAccountInfo.accountInfo.data);

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

// async function buy(accountId: PublicKey, accountData: LiquidityStateV4): Promise<void> {
//   try {
//     let tokenAccount = existingTokenAccounts.get(accountData.baseMint.toString());

//     if (!tokenAccount) {
//       // it's possible that we didn't have time to fetch open book data
//       const market = await getMinimalMarketV3(solanaConnection, accountData.marketId, COMMITMENT_LEVEL);
//       tokenAccount = saveTokenAccount(accountData.baseMint, market);
//     }

//     tokenAccount.poolKeys = createPoolKeys(accountId, accountData, tokenAccount.market!);
//     const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
//       {
//         poolKeys: tokenAccount.poolKeys,
//         userKeys: {
//           tokenAccountIn: quoteTokenAssociatedAddress,
//           tokenAccountOut: tokenAccount.address,
//           owner: wallet.publicKey,
//         },
//         amountIn: quoteAmount.raw,
//         minAmountOut: 0,
//       },
//       tokenAccount.poolKeys.version,
//     );

//     const latestBlockhash = await solanaConnection.getLatestBlockhash({
//       commitment: COMMITMENT_LEVEL,
//     });
//     const messageV0 = new TransactionMessage({
//       payerKey: wallet.publicKey,
//       recentBlockhash: latestBlockhash.blockhash,
//       instructions: [
//         ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
//         ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
//         createAssociatedTokenAccountIdempotentInstruction(
//           wallet.publicKey,
//           tokenAccount.address,
//           wallet.publicKey,
//           accountData.baseMint,
//         ),
//         ...innerTransaction.instructions,
//       ],
//     }).compileToV0Message();
//     const transaction = new VersionedTransaction(messageV0);
//     transaction.sign([wallet, ...innerTransaction.signers]);
//     const signature = await solanaConnection.sendRawTransaction(transaction.serialize(), {
//       preflightCommitment: COMMITMENT_LEVEL,
//     });
//     console.info({ mint: accountData.baseMint, signature }, `Sent buy tx`);
//     const confirmation = await solanaConnection.confirmTransaction(
//       {
//         signature,
//         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//         blockhash: latestBlockhash.blockhash,
//       },
//       COMMITMENT_LEVEL,
//     );
//     if (!confirmation.value.err) {
//       console.info(
//         {
//           mint: accountData.baseMint,
//           signature,
//           url: `https://solscan.io/tx/${signature}`,
//         },
//         `Confirmed buy tx`,
//       );
//     } else {
//       console.debug(confirmation.value.err);
//       console.info({ mint: accountData.baseMint, signature }, `Error confirming buy tx`);
//     }
//   } catch (e) {
//     console.debug(e);
//     console.error({ mint: accountData.baseMint }, `Failed to buy token`);
//   }
// }

// async function sell(accountId: PublicKey, mint: PublicKey, amount: BigNumberish): Promise<void> {
//   let sold = false;
//   let retries = 0;

//   do {
//     try {
//       const tokenAccount = existingTokenAccounts.get(mint.toString());

//       if (!tokenAccount) {
//         return;
//       }

//       if (!tokenAccount.poolKeys) {
//         console.warn({ mint }, 'No pool keys found');
//         return;
//       }

//       if (amount === 0) {
//         console.info(
//           {
//             mint: tokenAccount.mint,
//           },
//           `Empty balance, can't sell`,
//         );
//         return;
//       }

//       const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
//         {
//           poolKeys: tokenAccount.poolKeys!,
//           userKeys: {
//             tokenAccountOut: quoteTokenAssociatedAddress,
//             tokenAccountIn: tokenAccount.address,
//             owner: wallet.publicKey,
//           },
//           amountIn: amount,
//           minAmountOut: 0,
//         },
//         tokenAccount.poolKeys!.version,
//       );

//       const latestBlockhash = await solanaConnection.getLatestBlockhash({
//         commitment: COMMITMENT_LEVEL,
//       });
//       const messageV0 = new TransactionMessage({
//         payerKey: wallet.publicKey,
//         recentBlockhash: latestBlockhash.blockhash,
//         instructions: [
//           ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
//           ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
//           ...innerTransaction.instructions,
//           createCloseAccountInstruction(tokenAccount.address, wallet.publicKey, wallet.publicKey),
//         ],
//       }).compileToV0Message();
//       const transaction = new VersionedTransaction(messageV0);
//       transaction.sign([wallet, ...innerTransaction.signers]);
//       const signature = await solanaConnection.sendRawTransaction(transaction.serialize(), {
//         preflightCommitment: COMMITMENT_LEVEL,
//       });
//       console.info({ mint, signature }, `Sent sell tx`);
//       const confirmation = await solanaConnection.confirmTransaction(
//         {
//           signature,
//           lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
//           blockhash: latestBlockhash.blockhash,
//         },
//         COMMITMENT_LEVEL,
//       );
//       if (confirmation.value.err) {
//         console.debug(confirmation.value.err);
//         console.info({ mint, signature }, `Error confirming sell tx`);
//         continue;
//       }

//       console.info(
//         {
//           dex: `https://dexscreener.com/solana/${mint}?maker=${wallet.publicKey}`,
//           mint,
//           signature,
//           url: `https://solscan.io/tx/${signature}`,
//         },
//         `Confirmed sell tx`,
//       );
//       sold = true;
//     } catch (e: any) {
//       // wait for a bit before retrying
//       await new Promise((resolve) => setTimeout(resolve, 100));
//       retries++;
//       console.debug(e);
//       console.error({ mint }, `Failed to sell token, retry: ${retries}/${3}`);
//     }
//   } while (!sold && retries < 3);
// }

export const runListener = async () => {
  await init();
  const runTimestamp = Math.floor(new Date().getTime() / 1000);
  const raydiumSubscriptionId = solanaConnection.onProgramAccountChange(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    async (updatedAccountInfo) => {
      const key = updatedAccountInfo.accountId.toString();
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
      const poolOpenTime = parseInt(poolState.poolOpenTime.toString());
      const existing = existingLiquidityPools.has(key);

      if (poolOpenTime > runTimestamp && !existing) {
        existingLiquidityPools.add(key);
        const _ = processRaydiumPool(updatedAccountInfo.accountId, poolState);
      }
    },
    COMMITMENT_LEVEL,
    [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
          bytes: NATIVE_MINT.toBase58(),
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
          bytes: OPENBOOK_PROGRAM_ID.toBase58(),
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'),
          bytes: bs58.encode([6, 0, 0, 0, 0, 0, 0, 0]),
        },
      },
    ],
  );

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
          offset: MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint'),
          bytes: NATIVE_MINT.toBase58(),
        },
      },
    ],
  );

  console.info(`Listening for raydium changes: ${raydiumSubscriptionId}`);
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
