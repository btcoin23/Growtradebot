import { NATIVE_MINT } from "@solana/spl-token";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { QuoteGetRequest, SwapRequest, createJupiterApiClient } from '@jup-ag/api';
import bs58 from "bs58";
import { REFERRAL_ACCOUNT, connection } from "../config";
import { transactionSenderAndConfirmationWaiter } from "../utils/jupiter.transaction.sender";
import { getSignature } from "../utils/get.signature";
import { GasFeeEnum } from "./gas.fee.service";

export const JupiterService = {
  swapToken: async (pk: string, inputMint: string, outputMint: string, decimal: number, _amount: number, _slippage: number, gasFee: string = GasFeeEnum.HIGH) => {
    try {
      // 0.5% => 50
      const slippageBps = _slippage * 100;
      const amount = Number((_amount * 10 ** decimal).toFixed(0));
      const wallet = Keypair.fromSecretKey(bs58.decode(pk));

      const jupiterQuoteApi = createJupiterApiClient();
      const quotegetOpts: QuoteGetRequest = {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      }
      if (outputMint === NATIVE_MINT.toBase58()) {
        quotegetOpts.platformFeeBps = 50;
      }
      const quote = await jupiterQuoteApi.quoteGet(quotegetOpts);
      if (!quote) {
        console.error("unable to quote");
        return;
      }

      // Get serialized transaction
      const swapReqOpts: SwapRequest = {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }
      if (outputMint === NATIVE_MINT.toBase58()) {
        const [feeAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from("referral_ata"), new PublicKey(REFERRAL_ACCOUNT).toBuffer(), NATIVE_MINT.toBuffer()],
          new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3')
        );

        swapReqOpts.feeAccount = feeAccount.toBase58();
      }
      if (gasFee === GasFeeEnum.MEDIUM) {
        swapReqOpts.prioritizationFeeLamports = {
          autoMultiplier: 2,
        }
      } else if (gasFee === GasFeeEnum.HIGH) {
        swapReqOpts.prioritizationFeeLamports = {
          autoMultiplier: 3,
        }
      }
      const swapResult = await jupiterQuoteApi.swapPost({ swapRequest: swapReqOpts });

      // Serialize the transaction
      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, "base64");
      var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign the transaction
      transaction.sign([wallet]);
      const signature = getSignature(transaction);

      // We first simulate whether the transaction would be successful
      const { value: simulatedTransactionResponse } =
        await connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: true,
          commitment: "processed",
        });
      const { err, logs } = simulatedTransactionResponse;

      if (err) {
        // Simulation error, we can check the logs for more details
        // If you are getting an invalid account error, make sure that you have the input mint account to actually swap from.
        console.error("Simulation Error:");
        console.error({ err, logs });
        return;
      }

      const serializedTransaction = Buffer.from(transaction.serialize());
      const blockhash = transaction.message.recentBlockhash;

      const transactionResponse = await transactionSenderAndConfirmationWaiter({
        connection,
        serializedTransaction,
        blockhashWithExpiryBlockHeight: {
          blockhash,
          lastValidBlockHeight: swapResult.lastValidBlockHeight,
        },
      });

      // If we are not getting a response back, the transaction has not confirmed.
      if (!transactionResponse) {
        console.error("Transaction not confirmed");
        return;
      }

      if (transactionResponse.meta?.err) {
        console.error(transactionResponse.meta?.err);
        return null;
      }

      console.log(`https://solscan.io/tx/${signature}`);
      return signature;
    } catch (e) {
      console.log(e);
      return null;
    }
  }
}