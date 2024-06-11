import { PositionService } from "./position.service";
import { isEqual } from "../utils";
import { QuoteRes } from "./jupiter.service";
import { amount } from "@metaplex-foundation/js";

export class PNLService {
  wallet_address: string;
  mint: string;
  // username: string;
  quote: QuoteRes | undefined; // input: mint, output: SOL

  constructor(
    _wallet_address: string,
    _mint: string,
    // _username: string,
    _quote?: QuoteRes
  ) {
    this.wallet_address = _wallet_address;
    this.mint = _mint;
    // this.username = _username;
    this.quote = _quote;
  }

  // if wallet has SPL balance but there is no any record in position database
  // In this case, we need to synchorize
  // This happens only in case of relaunch
  async initialize() {
    const myposition = await PositionService.findLastOne({
      mint: this.mint,
      wallet_address: this.wallet_address
    });
    if (!this.quote) return;
    if (!myposition) {
      const {
        inAmount,
        outAmount
      } = this.quote;
      const ts = Date.now();

      await PositionService.create({
        // username: this.username,
        // chat_id: this.chat_id,
        mint: this.mint,
        wallet_address: this.wallet_address,
        volume: 0,
        sol_amount: outAmount,
        amount: inAmount,
        received_sol_amount: 0,
        creation_time: ts
      })
    } else if (myposition.sol_amount <= 0 && myposition.amount <= 0) {

      const {
        inAmount,
        outAmount
      } = this.quote;

      const filter = {
        wallet_address: this.wallet_address,
        mint: this.mint,
      };
      const data = {
        $inc: {
          sol_amount: outAmount,
          amount: inAmount
        }
      };
      await PositionService.findAndUpdateOne(filter, data);
    }
    return;
  }

  async getPNLInfo() {
    const position = await PositionService.findLastOne({
      wallet_address: this.wallet_address,
      mint: this.mint,
    });
    if (!position) return null;
    if (!this.quote) return;
    const { sol_amount, received_sol_amount } = position;
    const { outAmount } = this.quote;
    const profitInSOL = outAmount + received_sol_amount - sol_amount;
    const percent = profitInSOL * 100 / sol_amount;
    return { profitInSOL, percent };
  }
  /**
   * inAmount: SOL amount spent
   * outAmount: mint amount received
   */
  async afterBuy(inAmount: number, outAmount: number) {
    const filter = {
      wallet_address: this.wallet_address,
      mint: this.mint,
    };
    const res = await PositionService.findLastOne(filter);
    if (!res) {
      const ts = Date.now();
      return await PositionService.create({
        wallet_address: this.wallet_address,
        mint: this.mint,
        volume: 0,
        sol_amount: inAmount,
        amount: outAmount,
        received_sol_amount: 0.0,
        creation_time: ts
      })
    }
    const data = {
      $inc: {
        sol_amount: inAmount,
        amount: outAmount
      }
    };
    return await PositionService.findAndUpdateOne(filter, data);
  }

  /**
   * Update position after sell
   * @param outAmount received SOL amount
   * @param sellPercent sell percent
   * @returns 
   */
  async afterSell(outAmount: number, sellPercent: number) {
    const filter = {
      wallet_address: this.wallet_address,
      mint: this.mint,
    };
    if (isEqual(sellPercent, 100)) {
      const position = await PositionService.findLastOne(filter);
      if (!position) return;
      const { sol_amount, received_sol_amount } = position;
      const profit = outAmount + received_sol_amount - sol_amount;
      const data = {
        $inc: {
          volume: profit,
        },
        $set: {
          sol_amount: 0.0,
          received_sol_amount: 0.0,
          amount: 0.0,
        }
      }
      return await PositionService.findAndUpdateOne(filter, data);
    } else {
      const data = {
        $inc: {
          received_sol_amount: outAmount,
        }
      };
      return await PositionService.findAndUpdateOne(filter, data);
    }
  }
}