/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Referral Chat Schema
const ReferralHistorySchema = new Schema({
  username: {
    type: String,
    default: "",
  },
  referrer_address: {
    type: String,
    default: "",
  },
  amount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

export default mongoose.model("referralhistory", ReferralHistorySchema);
