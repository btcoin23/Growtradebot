import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import {
  getKeyPairFromPrivateKey,
  createTransaction,
  sendAndConfirmTransactionWrapper,
  bufferFromUInt64,
} from "./utils";
import { getCoinData } from "./api";
import {
  GLOBAL,
  FEE_RECIPIENT,
  SYSTEM_PROGRAM_ID,
  RENT,
  PUMP_FUN_ACCOUNT,
  PUMP_FUN_PROGRAM,
  ASSOC_TOKEN_ACC_PROG,
} from "./constants";
import { JitoBundleService, tipAccounts } from "../services/jito.bundle";
import { calculateMicroLamports } from "../raydium/raydium.service";
import { FeeService } from "../services/fee.service";
import { getSignature } from "../utils/get.signature";
import base58 from "bs58";
import { private_connection } from "../config";
import { UserTradeSettingService } from "../services/user.trade.setting.service";

export async function pumpFunSwap(
  payerPrivateKey: string,
  mintStr: string,
  decimal: number,
  is_buy: boolean,
  _amount: number,
  gasFee: number,
  _slippage: number,
  isFeeBurn: boolean,
  username: string,
  isToken2022: boolean
) {
  try {
    const coinData = await getCoinData(mintStr);
    if (!coinData) {
      console.error("Failed to retrieve coin data...");
      return;
    }

    // JitoFee
    const jitoFeeSetting = await UserTradeSettingService.getJitoFee(username);
    const jitoFeeValue =
      UserTradeSettingService.getJitoFeeValue(jitoFeeSetting);
    const jitoFeeValueWei = BigInt((jitoFeeValue * 10 ** 9).toFixed());

    const txBuilder = new Transaction();

    const payer = await getKeyPairFromPrivateKey(payerPrivateKey);
    const owner = payer.publicKey;
    const mint = new PublicKey(mintStr);
    const slippage = _slippage / 100;
    let total_fee_in_sol = 0;
    let total_fee_in_token = 0;
    let total_fee_percent = 0.01; // 1%
    let total_fee_percent_in_sol = 0.01; // 1%
    let total_fee_percent_in_token = 0;
    if (isFeeBurn) {
      total_fee_percent_in_sol = 0.0075;
      total_fee_percent_in_token = total_fee_percent - total_fee_percent_in_sol;
    }
    const fee =
      _amount *
      (is_buy ? total_fee_percent_in_sol : total_fee_percent_in_token);
    const inDecimal = is_buy ? 9 : decimal;
    const outDecimal = is_buy ? decimal : 9;
    const amount = Number(((_amount - fee) * 10 ** inDecimal).toFixed(0));

    const tokenAccountIn = getAssociatedTokenAddressSync(
      is_buy ? NATIVE_MINT : mint,
      owner,
      true
    );
    const tokenAccountOut = getAssociatedTokenAddressSync(
      is_buy ? mint : NATIVE_MINT,
      owner,
      true
    );

    const tokenAccountAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false
    );
    const keys = [
      { pubkey: GLOBAL, isSigner: false, isWritable: false },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey(coinData["bonding_curve"]),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(coinData["associated_bonding_curve"]),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: tokenAccountAddress, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: is_buy ? TOKEN_PROGRAM_ID : ASSOC_TOKEN_ACC_PROG,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: is_buy ? RENT : TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
    ];

    let data: Buffer;
    let quoteAmount = 0;

    if (is_buy) {
      const tokenOut = Math.floor(
        (amount * coinData["virtual_token_reserves"]) /
          coinData["virtual_sol_reserves"]
      );
      const solInWithSlippage = amount * (1 + slippage);
      const maxSolCost = Math.floor(solInWithSlippage * LAMPORTS_PER_SOL);

      data = Buffer.concat([
        bufferFromUInt64("16927863322537952870"),
        bufferFromUInt64(tokenOut),
        bufferFromUInt64(maxSolCost),
      ]);

      quoteAmount = tokenOut;
      total_fee_in_sol = Number((fee * 10 ** inDecimal).toFixed(0));
      total_fee_in_token = Number(
        (quoteAmount * total_fee_percent_in_token).toFixed(0)
      );
    } else {
      const minSolOutput = Math.floor(
        (amount! * (1 - slippage) * coinData["virtual_sol_reserves"]) /
          coinData["virtual_token_reserves"]
      );
      data = Buffer.concat([
        bufferFromUInt64("12502976635542562355"),
        bufferFromUInt64(amount),
        bufferFromUInt64(minSolOutput),
      ]);
      quoteAmount = minSolOutput;
      total_fee_in_token = Number((fee * 10 ** inDecimal).toFixed(0));
      total_fee_in_sol = Number(
        (Number(quoteAmount) * total_fee_percent_in_sol).toFixed(0)
      );
    }

    const instruction = new TransactionInstruction({
      keys: keys,
      programId: PUMP_FUN_PROGRAM,
      data: data,
    });
    txBuilder.add(instruction);

    // const jitoInstruction = await createTransaction(private_connection, txBuilder.instructions, payer.publicKey);
    const jitoInstruction = txBuilder.instructions;
    // console.log(instruction)

    const cu = 1_000_000;
    const microLamports = calculateMicroLamports(gasFee, cu);
    console.log("Is_BUY", is_buy);
    const instructions: TransactionInstruction[] = is_buy
      ? [
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: microLamports,
          }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: cu }),
          SystemProgram.transfer({
            fromPubkey: owner,
            toPubkey: new PublicKey(tipAccounts[0]),
            lamports: jitoFeeValueWei,
          }),
          createAssociatedTokenAccountIdempotentInstruction(
            owner,
            tokenAccountIn,
            owner,
            NATIVE_MINT
          ),
          SystemProgram.transfer({
            fromPubkey: owner,
            toPubkey: tokenAccountIn,
            lamports: amount,
          }),
          createSyncNativeInstruction(tokenAccountIn, TOKEN_PROGRAM_ID),
          createAssociatedTokenAccountIdempotentInstruction(
            owner,
            tokenAccountOut,
            owner,
            new PublicKey(mint)
          ),
          ...jitoInstruction,
          // Unwrap WSOL for SOL
          createCloseAccountInstruction(tokenAccountIn, owner, owner),
        ]
      : [
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: cu }),
          SystemProgram.transfer({
            fromPubkey: owner,
            toPubkey: new PublicKey(tipAccounts[0]),
            lamports: jitoFeeValueWei,
          }),
          createAssociatedTokenAccountIdempotentInstruction(
            owner,
            tokenAccountOut,
            owner,
            NATIVE_MINT
          ),
          ...jitoInstruction,
          // Unwrap WSOL for SOL
          createCloseAccountInstruction(tokenAccountOut, owner, owner),
        ];

    // Referral Fee, ReserverStaking Fee, Burn Token
    console.log("Before Fee: ", Date.now());
    const feeInstructions = await new FeeService().getFeeInstructions(
      total_fee_in_sol,
      total_fee_in_token,
      username,
      payerPrivateKey,
      is_buy ? mintStr : NATIVE_MINT.toString(),
      isToken2022
    );
    instructions.push(...feeInstructions);
    console.log("After Fee: ", Date.now());

    const { blockhash, lastValidBlockHeight } =
      await private_connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: owner,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    // transaction.sign([wallet]);
    transaction.sign([payer]);
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
    const bundleId = await jitoBundleInstance.sendBundle(rawTransaction);
    // const status = await getSignatureStatus(signature);
    if (!bundleId) return;
    console.log("BundleID", bundleId);
    console.log(`https://solscan.io/tx/${signature}`);
    const quote = { inAmount: amount, outAmount: quoteAmount };
    return {
      quote,
      signature,
      total_fee_in_sol,
      total_fee_in_token,
      bundleId,
    };

    // txBuilder.add(instruction);

    // const transaction = await createTransaction(connection, txBuilder.instructions, payer.publicKey, priorityFeeInSol);

    // if (transactionMode === TransactionMode.Execution) {
    //     const signature = await sendAndConfirmTransactionWrapper(connection, transaction, [payer]);
    //     console.log(`${isBuy ? 'Buy' : 'Sell'} transaction confirmed:`, signature);
    // } else if (transactionMode === TransactionMode.Simulation) {
    //     const simulatedResult = await connection.simulateTransaction(transaction);
    //     console.log(simulatedResult);
    // }
  } catch (error) {
    console.log(" - Swap pump token is failed", error);
  }
}
