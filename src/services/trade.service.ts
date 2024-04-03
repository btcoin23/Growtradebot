import { TradeSchema } from "../models/index";
import redisClient from "./redis";

export const TradeService = {
  create: async (props: any) => {
    try {
      return await TradeSchema.create(props);
    } catch (err: any) {
      console.log(err);
      throw new Error(err.message);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await TradeSchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await TradeSchema.findOne(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await TradeSchema.findOne(filter).sort({ updatedAt: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await TradeSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await TradeSchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const result = await TradeSchema.findOneAndDelete({ props });
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  // get mint
  getCustomTradeInfo: async (username: string, message_id: number) => {
    const key = `${username}${message_id}_trade`;
    const data = await redisClient.get(key);
    console.log("GET", key, data);
    return data;
  },
  storeCustomTradeInfo: async (mint: string, username: string, message_id: number) => {
    const key = `${username}${message_id}_trade`;
    console.log("SET", key, mint);

    await redisClient.set(key, mint);
    // we remove it for performance
    await redisClient.expire(key, 24 * 60 * 60);
  },
  getMintDecimal: async (mint: string) => {
    const key = `${mint}_decimal`;
    const data = await redisClient.get(key);
    if (data) return parseInt(data);
    return data;
  },
  setMintDecimal: async (mint: string, decimal: number) => {
    const key = `${mint}_decimal`;
    await redisClient.set(key, decimal);
  }
};
