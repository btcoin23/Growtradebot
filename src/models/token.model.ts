/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Token Schema
const Token = new Schema({
  // chat id
  chat_id: {
    type: String,
    default: "",
    required: true,
  },
  username: {
    type: String,
    default: "",
    required: true
  },
  private_key: {
    type: String,
    default: "",
    required: true,
    unique: true,
  },
  wallet_address: {
    type: String,
    default: "",
    required: true,
    unique: true,
  },
  nonce: {
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
Token.index({ username: 1, wallet_address: 1, nonce: 1 }, { unique: true });

export default mongoose.model("token", Token);
