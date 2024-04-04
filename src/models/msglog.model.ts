/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Trade Schema
const MsgLog = new Schema({
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
  },
  chat_id: {
    type: Number,
    default: 0,
    required: true,
  },
  msg_id: {
    type: Number,
    default: 0,
    required: true,
  },
  parent_msgid: {
    type: Number,
    default: 0,
  },
  sol_amount: {
    type: Number,
    default: 0,
  },
  spl_amount: {
    type: Number,
    default: 0,
  },
  extra_id: {
    type: Number,
  },
  creation_time: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

export default mongoose.model("msglog", MsgLog);
