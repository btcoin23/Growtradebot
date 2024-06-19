/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Referral Chat Schema
const ReferralChannelSchema = new Schema(
  {
    // chat id
    chat_id: {
      type: String,
      default: "",
      required: true,
    },
    channel_name: {
      type: String,
      default: "",
    },
    creator: {
      type: String,
      default: "",
      required: true,
    },
    referral_code: {
      type: String,
      default: "",
      required: true,
    },
  },
  {
    timestamps: true, // This option adds createdAt and updatedAt fields
  }
);

export default mongoose.model("referralchannel", ReferralChannelSchema);
