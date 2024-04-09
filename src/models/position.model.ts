/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Position Schema
const Position = new Schema({
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
    required: true
  },
  chat_id: {
    type: Number,
    default: 0,
    required: true,
  },
  volume: {
    type: Number,
    default: 0.0,
  },
  amount: {
    type: Number,
    default: 0.0,
  },
  creation_time: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

export default mongoose.model("position", Position);
