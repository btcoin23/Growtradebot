/** @format */

import mongoose from "mongoose";
const Schema = mongoose.Schema;

export const MarketSchema = new Schema({
  bids: {
    type: String,
    default: ""
  },
  asks: {
    type: String,
    default: ""
  },
  eventQueue: {
    type: String,
    default: ""
  },
})
// OpenMarket Schema
const OpenMarket = new Schema({
  mint: {
    type: String,
    default: "",
    required: true,
    unique: true,
  },
  market: {
    type: MarketSchema,
    required: true,
  },
}, {
  timestamps: true  // This option adds createdAt and updatedAt fields
});


export default mongoose.model("openmarket", OpenMarket);
