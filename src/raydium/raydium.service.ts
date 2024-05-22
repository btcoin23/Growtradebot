
import {
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TOKEN_PROGRAM_ID,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from "bs58";
import { createPoolKeys, convertDBForPoolStateV4 } from './liquidity';
import { convertDBForMarketV3, getMinimalMarketV3 } from './market';
import { QuoteRes } from '../services/jupiter.service';
import { createAssociatedTokenAccountIdempotentInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync, NATIVE_MINT } from '@solana/spl-token';
import { OpenMarketService } from '../services/openmarket.service';
import { COMMITMENT_LEVEL, private_connection } from '../config';
import { RaydiumTokenService } from '../services/raydium.token.service';
import { MinimalTokenAccountData, saveTokenAccount } from './raydium';
import { getSignature } from '../utils/get.signature';
import { JitoBundleService, tipAccounts } from '../services/jito.bundle';
import { FeeService } from '../services/fee.service';
import { default as BN } from "bn.js";

export const estimateSwapRate = async (
  connection: Connection,
  poolinfo: any,
  marketinfo: any,
  inAmount: number,
  swapInDirection: boolean,
  inDecimal?: number,
  outDecimal?: number,
) => {
  try {
    const { poolId, poolState } = poolinfo;
    const { market } = marketinfo;
    const poolKeys = createPoolKeys(
      new PublicKey(poolId),
      convertDBForPoolStateV4(poolState),
      convertDBForMarketV3(market)
    )
    const {
      inputMint,
      outputMint,
      // amountIn,
      amountOut,
      // minAmountOut,
      // currentPrice,
      // executionPrice,
      priceImpact,
      // fee,
    } = await calcAmountOut(connection, poolKeys, inAmount, swapInDirection);
    const outAmount = Number(amountOut.numerator) / Number(amountOut.denominator);
    const priceImpactPct = 100 * Number(priceImpact.numerator) / Number(priceImpact.denominator);
    // const curPrice = Number(currentPrice.numerator) / Number(currentPrice.denominator);

    if (!inDecimal || !outDecimal) {
      return {
        inputMint,
        outputMint,
        inAmount,
        outAmount,
        priceImpactPct,
        // priceInSOL: curPrice
      } as QuoteRes

    }
    return {
      inputMint,
      outputMint,
      inAmount: inAmount * (10 ** inDecimal),
      outAmount: outAmount * (10 ** outDecimal),
      priceImpactPct,
      // priceInSOL: curPrice
    } as QuoteRes
  } catch (e) {
    console.log("Faild", e);
    return null;;
  }
};

export const getPriceInSOL = async (poolinfo: any, connection: Connection) => {
  try {
    const { baseVault, quoteVault } = poolinfo.poolState;
    const baseBalance = (await connection.getTokenAccountBalance(new PublicKey(baseVault))).value.uiAmount;
    const quoteBalance = (await connection.getTokenAccountBalance(new PublicKey(quoteVault))).value.uiAmount;
    if (!baseBalance || !quoteBalance) {
      return {
        priceInSOL: 0,
        baseBalance: 0,
        quoteBalance: 0
      };
    }

    const priceInSOL = quoteBalance / baseBalance
    return {
      priceInSOL,
      baseBalance,
      quoteBalance
    }
  } catch (e) {
    return {
      priceInSOL: 0,
      baseBalance: 0,
      quoteBalance: 0
    }
  }
}

export const calcAmountOut = async (connection: Connection, poolKeys: LiquidityPoolKeys, rawAmountIn: number, swapInDirection: boolean) => {
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

  const currencyIn = new Token(TOKEN_PROGRAM_ID, currencyInMint, currencyInDecimals);
  const amountIn = new TokenAmount(currencyIn, rawAmountIn, false);
  const currencyOut = new Token(TOKEN_PROGRAM_ID, currencyOutMint, currencyOutDecimals);
  const slippage = new Percent(20, 100); // 20% slippage

  const {
    amountOut,
    minAmountOut,
    currentPrice,
    executionPrice,
    priceImpact,
    fee,
  } = Liquidity.computeAmountOut({ poolKeys, poolInfo, amountIn, currencyOut, slippage });

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
}

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
        total_fee_percent_in_token = total_fee_percent - total_fee_percent_in_sol;
      }
      // 0.5% => 50
      // const slippageBps = _slippage * 100;
      const fee = _amount * (is_buy ? total_fee_percent_in_sol : total_fee_percent_in_token);
      // in_amount
      const amount = Number(((_amount - fee) * 10 ** decimal).toFixed(0));
      const wallet = Keypair.fromSecretKey(bs58.decode(pk));

      const poolinfo = await RaydiumTokenService.findLastOne({ mint });
      if (!poolinfo) return;
      const { poolId, poolState } = poolinfo;

      let tokenAccount: MinimalTokenAccountData;
      const marketinfo = await OpenMarketService.findLastOne({ mint });
      if (!marketinfo) {
        // it's possible that we didn't have time to fetch open book data
        const market = await getMinimalMarketV3(private_connection, new PublicKey(poolState.marketId), COMMITMENT_LEVEL);
        const newTokenAccount = await saveTokenAccount(new PublicKey(mint), market);
        if (!newTokenAccount) return;
        tokenAccount = newTokenAccount;
      } else {
        tokenAccount = {
          mint: new PublicKey(marketinfo.mint),
          market: convertDBForMarketV3(marketinfo.market)
        } as MinimalTokenAccountData
      }

      const inDecimal = is_buy ? 9 : decimal;
      const outDecimal = is_buy ? decimal : 9;
      const quote = await estimateSwapRate(
        private_connection,
        poolinfo,
        marketinfo,
        amount / 10 ** inDecimal,
        is_buy,
        inDecimal,
        outDecimal
      )

      console.log("🚀 Quote ~", Date.now())
      if (!quote) {
        console.error("unable to quote");
        return;
      }
      if (is_buy) {
        total_fee_in_sol = Number((fee * 10 ** decimal).toFixed(0));
        total_fee_in_token = Number((Number(quote.outAmount) * total_fee_percent_in_token).toFixed(0));
      } else {
        total_fee_in_token = Number((fee * 10 ** decimal).toFixed(0));
        total_fee_in_sol = Number((Number(quote.outAmount) * total_fee_percent_in_sol).toFixed(0));
      }

      tokenAccount.poolKeys = createPoolKeys(
        new PublicKey(poolId),
        convertDBForPoolStateV4(poolState),
        tokenAccount.market!
      );

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

      const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
        {
          poolKeys: tokenAccount.poolKeys,
          userKeys: {
            tokenAccountIn,
            tokenAccountOut,
            owner: wallet.publicKey,
          },
          amountIn: amount,
          minAmountOut: new BN(1),
        },
        tokenAccount.poolKeys.version,
      );

      // // Gas in SOL
      const cu = 101337;
      const microLamports = calculateMicroLamports(gasFee, cu);
      console.log("Is_BUY", is_buy);
      const instructions: TransactionInstruction[] = is_buy ? [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamports }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: cu }),
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          tokenAccountIn,
          wallet.publicKey,
          NATIVE_MINT,
        ),
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: tokenAccountIn,
          lamports: amount
        }),
        createSyncNativeInstruction(
          tokenAccountIn,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          tokenAccountOut,
          wallet.publicKey,
          new PublicKey(mint),
        ),
        ...innerTransaction.instructions,
      ] : [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
        ...innerTransaction.instructions,
      ]

      // JitoTipOption
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(tipAccounts[0]),
          lamports: 1_500_000
        })
      )

      // Referral Fee, ReserverStaking Fee, Burn Token
      console.log("Before Fee: ", Date.now())
      const feeInstructions = await (new FeeService()).getFeeInstructions(
        total_fee_in_sol,
        total_fee_in_token,
        username,
        pk,
        is_buy ? outputMint : inputMint,
        isToken2022
      );
      instructions.push(...feeInstructions);
      console.log("After Fee: ", Date.now())

      const { blockhash, lastValidBlockHeight } = await private_connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      // transaction.sign([wallet]);
      transaction.sign([wallet, ...innerTransaction.signers]);
      // Sign the transaction
      const signature = getSignature(transaction);

      // We first simulate whether the transaction would be successful
      const { value: simulatedTransactionResponse } =
        await private_connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: true,
          commitment: "processed",
        });
      const { err, logs } = simulatedTransactionResponse;

      console.log("🚀 Simulate ~", Date.now())
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
        quote,
        signature,
        total_fee_in_sol,
        total_fee_in_token
      };
    } catch (e) {
      console.log("SwapToken Failed", e);
      return null;
    }
  };
}

export const calculateMicroLamports = (gasvalue: number, cu: number) => {
  const microlamports = ((gasvalue - 0.000005) * (10 * 15 / cu)).toFixed(0);
  return Number(microlamports);
}