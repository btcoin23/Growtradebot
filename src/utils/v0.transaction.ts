import { AddressLookupTableProgram, Connection, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getSignature } from "./get.signature";
import { transactionSenderAndConfirmationWaiter } from "./jupiter.transaction.sender";
import { wait } from "./wait";
import { connection } from "../config";

const COMMITMENT_LEVEL = 'confirmed';

export async function sendTransactionV0(
  connection: Connection,
  instructions: TransactionInstruction[],
  payers: Keypair[],
): Promise<string | null> {
  let latestBlockhash = await connection
    .getLatestBlockhash(COMMITMENT_LEVEL)

  const messageV0 = new TransactionMessage({
    payerKey: payers[0].publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign(payers);
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
    return null;
  }

  const serializedTransaction = Buffer.from(transaction.serialize());
  const blockhash = transaction.message.recentBlockhash;

  const transactionResponse = await transactionSenderAndConfirmationWaiter({
    connection,
    serializedTransaction,
    blockhashWithExpiryBlockHeight: {
      blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
  });

  // If we are not getting a response back, the transaction has not confirmed.
  if (!transactionResponse) {
    console.error("Transaction not confirmed");
    return null;
  }

  if (transactionResponse.meta?.err) {
    console.error(transactionResponse.meta?.err);
    return null;
  }

  return signature;
}

export const getSignatureStatus = async (signature: string) => {
  try {
    const maxRetry = 30;
    let retries = 0;
    while (retries < maxRetry) {
      await wait(1_000);
      retries++;

      const tx = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: false,
      });
      if (tx?.value?.err) {
        console.log("JitoTransaction Failed");
        break;
      }
      if (tx?.value?.confirmationStatus === "confirmed" || tx?.value?.confirmationStatus === "finalized") {
        retries = 0;
        console.log("JitoTransaction confirmed!!!");
        break;
      }
    }

    if (retries > 0) return false;
    return true;
  } catch (e) {
    return false;
  }
}
