import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { get_referral_info } from "./referral.service";
import { RESERVE_WALLET } from "../config";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export class FeeService {
  async getFeeInstructions(
    total_fee_in_sol: number,
    total_fee_in_token: number,
    username: string,
    pk: string,
    mint: string,
    isToken2022: boolean
  ) {
    try {
      const wallet = Keypair.fromSecretKey(bs58.decode(pk));
      let ref_info = await get_referral_info(username);
      console.log("🚀 ~ ref_info:", ref_info);

      let referralWallet: PublicKey = RESERVE_WALLET;
      if (ref_info && ref_info.referral_address) {
        const { referral_address } = ref_info;
        console.log("🚀 ~ referral_address:", referral_address);
        referralWallet = new PublicKey(ref_info.referral_address);
      }

      console.log("🚀 ~ referralWallet:", referralWallet);
      const referralFeePercent = ref_info?.referral_option ?? 0; // 25%

      const referralFee = Number(
        ((total_fee_in_sol * referralFeePercent) / 100).toFixed(0)
      );
      const reserverStakingFee = total_fee_in_sol - referralFee;

      console.log(
        "Fee total:",
        total_fee_in_sol,
        total_fee_in_token,
        referralFee,
        reserverStakingFee
      );
      const instructions: TransactionInstruction[] = [];
      if (reserverStakingFee > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: RESERVE_WALLET,
            lamports: reserverStakingFee,
          })
        );
      }

      if (referralFee > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: referralWallet,
            lamports: referralFee,
          })
        );
      }

      if (total_fee_in_token) {
        // Burn
        const ata = getAssociatedTokenAddressSync(
          new PublicKey(mint),
          wallet.publicKey,
          true,
          isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
        );
        instructions.push(
          createBurnInstruction(
            ata,
            new PublicKey(mint),
            wallet.publicKey,
            BigInt(total_fee_in_token),
            [],
            isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
          )
        );
      }
      return instructions;
    } catch (e) {
      console.log("- Fee handler has issue", e);
      return [];
    }
  }
}
