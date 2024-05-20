/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Referral Chat Schema
const ReferrerListSchema = new Schema({
  // chat id
  chatId: {
    type: String,
    default: "",
    required: true
  },
  messageId: {
    type: String,
    default: "",
    required: true
  },
  referrer: {
    type: String,
    default: "",
    required: true
  },
  channelName: {
    type: String,
    default: "",
    required: true
  },
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

export default mongoose.model("referrerList", ReferrerListSchema);
