/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Define enum values for trade_type
export const TradeTypeEnum = {
  NONE: 0,
  BUY: 1,
  SELL: 2,
  SNIPE: 3
};

// Trade Schema
const Trade = new Schema({
  username: {
    type: String,
    default: "",
    required: true
  },
  mint: {
    type: String,
    default: "",
    required: true,
  },
  wallet_address: {
    type: String,
    default: "",
    required: true,
  },
  trade_type: {
    type: Number,
    default: TradeTypeEnum.NONE, // Default value set to NONE
    enum: Object.values(TradeTypeEnum) // Allowed enum values
  },
  sol_amount: {
    type: Number,
    default: 0,
  },
  sol_price: {
    type: Number,
    default: 0,
  },
  spl_amount: {
    type: Number,
    default: 0,
  },
  spl_price: {
    type: Number,
    default: 0,
  },
  nonce: {
    type: Number,
    default: 0,
  },
  creation_time: {
    type: Number,
    default: 0,
  },
  retired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

// Create compound index for username, wallet_address, and nonce
Trade.index({ mint: 1, wallet_address: 1, nonce: 1 }, { unique: true });

export default mongoose.model("trade", Trade);
