import {
  ApiClmmPoolsItem,
  jsonInfo2PoolKeys,
  Clmm,
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  fetchMultipleMintInfos,
  Percent,
  Token,
  TokenAmount,
  Liquidity,
  LiquidityPoolKeys,
  TOKEN_PROGRAM_ID,
  MAINNET_PROGRAM_ID as PROGRAMIDS,
} from "@raydium-io/raydium-sdk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { createPoolKeys, convertDBForPoolStateV4 } from "./liquidity";
import { convertDBForMarketV3, getMinimalMarketV3 } from "./market";
import { QuoteRes } from "../services/jupiter.service";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { OpenMarketService } from "../services/openmarket.service";
import { private_connection } from "../config";
import { RaydiumTokenService } from "../services/raydium.token.service";
import { getSignature } from "../utils/get.signature";
import { JitoBundleService, tipAccounts } from "../services/jito.bundle";
import { FeeService } from "../services/fee.service";
import { formatClmmKeysById } from "./utils/formatClmmKeysById";
import { formatAmmKeysById } from "./utils/formatAmmKeysById";

import { default as BN } from "bn.js";
import { REQUEST_HEADER } from "../config";

export const getPriceInSOL = async (tokenAddress: string): Promise<number> => {
  try {
    const options = { method: "GET", headers: REQUEST_HEADER };
    const response1 = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${tokenAddress}`,
      options
    );
    const res1 = await response1.json();
    const priceInUSD = res1.data.value;

    const response2 = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${NATIVE_MINT}`,
      options
    );
    const res2 = await response2.json();
    const solPrice = res2.data.value;
    const priceInSol = Number(priceInUSD) / Number(solPrice);
    return Number(priceInSol);
  } catch (e) {
    // If an error occurs, return a default value (e.g., 0)
    return 0;
  }
};

export const calcAmountOut = async (
  connection: Connection,
  poolKeys: LiquidityPoolKeys,
  rawAmountIn: number,
  swapInDirection: boolean
) => {
  const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
  let currencyInMint = poolKeys.baseMint;
  let currencyInDecimals = poolInfo.baseDecimals;
  let currencyOutMint = poolKeys.quoteMint;
  let currencyOutDecimals = poolInfo.quoteDecimals;

  if (swapInDirection) {
    currencyInMint = poolKeys.quoteMint;
    currencyInDecimals = poolInfo.quoteDecimals;
    currencyOutMint = poolKeys.baseMint;
    currencyOutDecimals = poolInfo.baseDecimals;
  }

  const currencyIn = new Token(
    TOKEN_PROGRAM_ID,
    currencyInMint,
    currencyInDecimals
  );
  const amountIn = new TokenAmount(currencyIn, rawAmountIn, false);
  const currencyOut = new Token(
    TOKEN_PROGRAM_ID,
    currencyOutMint,
    currencyOutDecimals
  );
  const slippage = new Percent(100); // 100% slippage

  const {
    amountOut,
    minAmountOut,
    currentPrice,
    executionPrice,
    priceImpact,
    fee,
  } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn,
    currencyOut,
    slippage,
  });

  return {
    inputMint: currencyInMint.toBase58(),
    outputMint: currencyOutMint.toBase58(),
    amountIn,
    amountOut,
    minAmountOut,
    currentPrice,
    executionPrice,
    priceImpact,
    fee,
  };
};

export class RaydiumSwapService {
  constructor() { }

  async swapToken(
    pk: string,
    inputMint: string,
    outputMint: string,
    decimal: number,
    _amount: number,
    _slippage: number,
    gasFee: number,
    isFeeBurn: boolean,
    username: string,
    isToken2022: boolean
  ) {
    try {
      let total_fee_in_sol = 0;
      let total_fee_in_token = 0;
      const is_buy = inputMint === NATIVE_MINT.toBase58();
      const mint = is_buy ? outputMint : inputMint;

      let total_fee_percent = 0.01; // 1%
      let total_fee_percent_in_sol = 0.01; // 1%
      let total_fee_percent_in_token = 0;

      if (isFeeBurn) {
        total_fee_percent_in_sol = 0.0075;
        total_fee_percent_in_token =
          total_fee_percent - total_fee_percent_in_sol;
      }
      const fee =
        _amount *
        (is_buy ? total_fee_percent_in_sol : total_fee_percent_in_token);

      const inDecimal = is_buy ? 9 : decimal;
      const outDecimal = is_buy ? decimal : 9;
      // in_amount
      const amount = Number(((_amount - fee) * 10 ** inDecimal).toFixed(0));
      const wallet = Keypair.fromSecretKey(bs58.decode(pk));

      const poolinfo = await RaydiumTokenService.findLastOne({ mint });
      if (!poolinfo) return;
      const { isAmm, poolId } = poolinfo;

      const tokenPrice = await getPriceInSOL(mint);
      const quoteAmount = is_buy
        ? (amount * 10 ** (outDecimal - inDecimal)) / tokenPrice
        : amount * tokenPrice * 10 ** (outDecimal - inDecimal);

      console.log("🚀 Quote ~", quoteAmount);
      if (!quoteAmount) {
        console.error("unable to quote");
        return;
      }

      if (is_buy) {
        total_fee_in_sol = Number((fee * 10 ** inDecimal).toFixed(0));
        total_fee_in_token = Number(
          (Number(quoteAmount) * total_fee_percent_in_token).toFixed(0)
        );
      } else {
        total_fee_in_token = Number((fee * 10 ** inDecimal).toFixed(0));
        total_fee_in_sol = Number(
          (Number(quoteAmount) * total_fee_percent_in_sol).toFixed(0)
        );
      }

      const tokenAccountIn = getAssociatedTokenAddressSync(
        new PublicKey(inputMint),
        wallet.publicKey,
        true
      );
      const tokenAccountOut = getAssociatedTokenAddressSync(
        new PublicKey(outputMint),
        wallet.publicKey,
        true
      );

      const inputToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey(inputMint),
        inDecimal
      );
      const inputTokenAmount = new TokenAmount(
        inputToken,
        new BN(amount.toString(), 10)
      );

      const outputToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey(outputMint),
        outDecimal
      );

      const targetPool = poolId;
      const connection = private_connection;
      const slippage = new Percent(_slippage);
      let jitoInstruction;
      console.log(isAmm);
      console.log(_slippage);
      if (isAmm) {
        // -------- pre-action: get pool info --------
        const targetPoolInfo = await formatAmmKeysById(targetPool);
        if (!targetPoolInfo) {
          console.log("🚀 cannot find the target pool", 11);
          return;
        }
        const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

        // -------- step 2: create instructions by SDK function --------
        const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
          {
            poolKeys,
            userKeys: {
              tokenAccountIn,
              tokenAccountOut,
              owner: wallet.publicKey,
            },
            amountIn: amount,
            minAmountOut: new BN(0),
          },
          poolKeys.version
        );

        jitoInstruction = innerTransaction;
      } else {
        // -------- pre-action: get pool info --------
        const clmmPools: ApiClmmPoolsItem[] = [
          await formatClmmKeysById(targetPool),
        ];
        const { [targetPool]: clmmPoolInfo } =
          await Clmm.fetchMultiplePoolInfos({
            connection,
            poolKeys: clmmPools,
            chainTime: new Date().getTime() / 1000,
          });

        // -------- step 1: fetch tick array --------
        const tickCache = await Clmm.fetchMultiplePoolTickArrays({
          connection,
          poolKeys: [clmmPoolInfo.state],
          batchRequest: true,
        });

        // -------- step 2: calc amount out by SDK function --------
        // Configure input/output parameters, in this example, this token amount will swap 0.0001 USDC to RAY
        const { minAmountOut, remainingAccounts } = Clmm.computeAmountOutFormat(
          {
            poolInfo: clmmPoolInfo.state,
            tickArrayCache: tickCache[targetPool],
            amountIn: inputTokenAmount,
            currencyOut: outputToken,
            slippage,
            epochInfo: await connection.getEpochInfo(),
            token2022Infos: await fetchMultipleMintInfos({
              connection,
              mints: [
                ...clmmPools
                  .map((i) => [
                    { mint: i.mintA, program: i.mintProgramIdA },
                    { mint: i.mintB, program: i.mintProgramIdB },
                  ])
                  .flat()
                  .filter((i) => i.program === TOKEN_2022_PROGRAM_ID.toString())
                  .map((i) => new PublicKey(i.mint)),
              ],
            }),
            catchLiquidityInsufficient: true,
          }
        );
        const tokenAccountA = getAssociatedTokenAddressSync(
          NATIVE_MINT,
          wallet.publicKey,
          true
        );
        const tokenAccountB = getAssociatedTokenAddressSync(
          new PublicKey(mint),
          wallet.publicKey,
          true
        );

        Clmm.computeAmountOut;

        // -------- step 3: create instructions by SDK function --------
        const { innerTransaction } = Clmm.makeSwapBaseInInstructions({
          poolInfo: clmmPoolInfo.state,
          ownerInfo: {
            wallet: wallet.publicKey,
            tokenAccountA,
            tokenAccountB,
          },
          inputMint: inputTokenAmount.token.mint,
          amountIn: inputTokenAmount.raw,
          amountOutMin: new BN(0),
          sqrtPriceLimitX64: new BN(0),
          remainingAccounts,
        });
        jitoInstruction = innerTransaction;
      }

      // // Gas in SOL
      const cu = 1_000_000;
      const microLamports = calculateMicroLamports(gasFee, cu);
      console.log("Is_BUY", is_buy);
      const instructions: TransactionInstruction[] = is_buy
        ? [
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: microLamports,
          }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: cu }),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            tokenAccountIn,
            wallet.publicKey,
            NATIVE_MINT
          ),
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: tokenAccountIn,
            lamports: amount,
          }),
          createSyncNativeInstruction(tokenAccountIn, TOKEN_PROGRAM_ID),
          createAssociatedTokenAccountIdempotentInstruction(
            wallet.publicKey,
            tokenAccountOut,
            wallet.publicKey,
            new PublicKey(mint)
          ),
          ...jitoInstruction.instructions,
        ]
        : [
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
          ...jitoInstruction.instructions,
        ];

      // JitoTipOption
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(tipAccounts[0]),
          lamports: 1_500_000,
        })
      );

      // Referral Fee, ReserverStaking Fee, Burn Token
      console.log("Before Fee: ", Date.now());
      const feeInstructions = await new FeeService().getFeeInstructions(
        total_fee_in_sol,
        total_fee_in_token,
        username,
        pk,
        is_buy ? outputMint : inputMint,
        isToken2022
      );
      instructions.push(...feeInstructions);
      console.log("After Fee: ", Date.now());

      const { blockhash, lastValidBlockHeight } =
        await private_connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      // transaction.sign([wallet]);
      transaction.sign([wallet, ...jitoInstruction.signers]);
      // Sign the transaction
      const signature = getSignature(transaction);

      // We first simulate whether the transaction would be successful
      const { value: simulatedTransactionResponse } =
        await private_connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: true,
          commitment: "processed",
        });
      const { err, logs } = simulatedTransactionResponse;

      console.log("🚀 Simulate ~", Date.now());
      // if (!err) return;

      if (err) {
        // Simulation error, we can check the logs for more details
        // If you are getting an invalid account error, make sure that you have the input mint account to actually swap from.
        console.error("Simulation Error:");
        console.error({ err, logs });
        return;
      }

      const rawTransaction = transaction.serialize();

      // Netherland
      // const jitoBundleInstance = new JitoBundleService("ams");
      const jitoBundleInstance = new JitoBundleService();
      const result = await jitoBundleInstance.sendTransaction(rawTransaction);
      // const status = await getSignatureStatus(signature);
      // if (!status) return null;
      console.log("Transaction Result", result);
      console.log(`https://solscan.io/tx/${signature}`);

      return {
        quote: { inAmount: amount, outAmount: quoteAmount },
        signature,
        total_fee_in_sol,
        total_fee_in_token,
      };
    } catch (e) {
      console.log("SwapToken Failed", e);
      return null;
    }
  }
}

export async function getWalletTokenAccount(
  connection: Connection,
  wallet: PublicKey
): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}

export const calculateMicroLamports = (gasvalue: number, cu: number) => {
  const microlamports = ((gasvalue - 0.000005) * ((10 * 15) / cu)).toFixed(0);
  return Number(microlamports);
};
