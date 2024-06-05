/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Token Schema
const Token = new Schema(
  {
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
    isAmm: {
      type: Boolean,
      default: false,
      required: true,
    },
    poolId: {
      type: String,
      default: "",
      required: true,
      unique: true,
    },
    creation_ts: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true, // This option adds createdAt and updatedAt fields
  }
);

// Create compound index for username, wallet_address, and nonce
export default mongoose.model("token", Token);
