/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

export const PoolStateSchema = new Schema({
  status: {
    type: String,
    default: ""
  },
  nonce: {
    type: String,
    default: ""
  },
  maxOrder: {
    type: String,
    default: ""
  },
  depth: {
    type: String,
    default: ""
  },
  baseDecimal: {
    type: String,
    default: ""
  },
  quoteDecimal: {
    type: String,
    default: ""
  },
  state: {
    type: String,
    default: ""
  },
  resetFlag: {
    type: String,
    default: ""
  },
  minSize: {
    type: String,
    default: ""
  },
  volMaxCutRatio: {
    type: String,
    default: ""
  },
  amountWaveRatio: {
    type: String,
    default: ""
  },
  baseLotSize: {
    type: String,
    default: ""
  },
  quoteLotSize: {
    type: String,
    default: ""
  },
  minPriceMultiplier: {
    type: String,
    default: ""
  },
  maxPriceMultiplier: {
    type: String,
    default: ""
  },
  systemDecimalValue: {
    type: String,
    default: ""
  },
  minSeparateNumerator: {
    type: String,
    default: ""
  },
  minSeparateDenominator: {
    type: String,
    default: ""
  },
  tradeFeeNumerator: {
    type: String,
    default: ""
  },
  tradeFeeDenominator: {
    type: String,
    default: ""
  },
  pnlNumerator: {
    type: String,
    default: ""
  },
  pnlDenominator: {
    type: String,
    default: ""
  },
  swapFeeNumerator: {
    type: String,
    default: ""
  },
  swapFeeDenominator: {
    type: String,
    default: ""
  },
  baseNeedTakePnl: {
    type: String,
    default: ""
  },
  quoteNeedTakePnl: {
    type: String,
    default: ""
  },
  quoteTotalPnl: {
    type: String,
    default: ""
  },
  baseTotalPnl: {
    type: String,
    default: ""
  },
  poolOpenTime: {
    type: String,
    default: ""
  },
  punishPcAmount: {
    type: String,
    default: ""
  },
  punishCoinAmount: {
    type: String,
    default: ""
  },
  orderbookToInitTime: {
    type: String,
    default: ""
  },
  swapBaseInAmount: {
    type: String,
    default: ""
  },
  swapQuoteOutAmount: {
    type: String,
    default: ""
  },
  swapBase2QuoteFee: {
    type: String,
    default: ""
  },
  swapQuoteInAmount: {
    type: String,
    default: ""
  },
  swapBaseOutAmount: {
    type: String,
    default: ""
  },
  swapQuote2BaseFee: {
    type: String,
    default: ""
  },
  baseVault: {
    type: String,
    default: ""
  },
  quoteVault: {
    type: String,
    default: ""
  },
  baseMint: {
    type: String,
    default: ""
  },
  quoteMint: {
    type: String,
    default: ""
  },
  lpMint: {
    type: String,
    default: ""
  },
  openOrders: {
    type: String,
    default: ""
  },
  marketId: {
    type: String,
    default: ""
  },
  marketProgramId: {
    type: String,
    default: ""
  },
  targetOrders: {
    type: String,
    default: ""
  },
  withdrawQueue: {
    type: String,
    default: ""
  },
  lpVault: {
    type: String,
    default: ""
  },
  owner: {
    type: String,
    default: ""
  },
  lpReserve: {
    type: String,
    default: ""
  },
});
// Token Schema
const Token = new Schema({
  name: {
    type: String,
    default: "",
  },
  symbol: {
    type: String,
    default: "",
  },
  mint: {
    type: String,
    default: "",
    required: true,
  },
  poolId: {
    type: String,
    default: "",
    required: true,
    unique: true,
  },
  poolState: {
    type: PoolStateSchema,
    required: true,
  },
  creation_ts: {
    type: Number,
    required: true,
  }
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

// Create compound index for username, wallet_address, and nonce
export default mongoose.model("token", Token);
