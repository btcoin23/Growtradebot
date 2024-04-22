/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Basic Schema
const ReferralUserSchema = new Schema({
  // chat id
  chat_id: {
    type: String,
    default: "",
    required: true,
  },
  first_name: {
    type: String,
    default: "",
    required: true
  },
  last_name: {
    type: String,
    default: "",
  },
  username: {
    type: String,
    default: "",
    required: true
  },
  referral_code: {
    type: String,
    default: "",
    required: true
  },
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});

export default mongoose.model("referral", ReferralUserSchema);
