import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

export async function getKeyPairFromPrivateKey(key: string) {
  return Keypair.fromSecretKey(new Uint8Array(bs58.decode(key)));
}

export async function createTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: PublicKey,
  priorityFeeInSol: number = 0
): Promise<Transaction> {
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1400000,
  });

  const transaction = new Transaction().add(modifyComputeUnits);

  if (priorityFeeInSol > 0) {
    const microLamports = priorityFeeInSol * 1_000_000_000; // convert SOL to microLamports
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports,
    });
    transaction.add(addPriorityFee);
  }

  transaction.add(...instructions);

  transaction.feePayer = payer;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash()
  ).blockhash;
  return transaction;
}

export async function sendAndConfirmTransactionWrapper(
  connection: Connection,
  transaction: Transaction,
  signers: any[]
) {
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      { skipPreflight: true, preflightCommitment: "confirmed" }
    );
    console.log("Transaction confirmed with signature:", signature);
    return signature;
  } catch (error) {
    console.error("Error sending transaction:", error);
    return null;
  }
}

export function bufferFromUInt64(value: number | string) {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}
