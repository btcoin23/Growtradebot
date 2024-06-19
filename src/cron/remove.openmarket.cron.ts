import { NATIVE_MINT } from "@solana/spl-token";
import cron from "node-cron";
import redisClient from "../services/redis";
import { OpenMarketSchema } from "../models";
const EVERY_1_MIN = "*/1 * * * *";
export const runOpenmarketCronSchedule = () => {
  try {
    cron
      .schedule(EVERY_1_MIN, () => {
        removeOldDatas();
      })
      .start();
  } catch (error) {
    console.error(
      `Error running the Schedule Job for fetching the chat data: ${error}`
    );
  }
};

const removeOldDatas = async () => {
  try {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    try {
      const result = await OpenMarketSchema.deleteMany({
        createdAt: { $lt: threeHoursAgo },
      });
      console.log(`Deleted ${result.deletedCount} old documents.`);
    } catch (error) {
      console.error("Error deleting old documents:", error);
    }
  } catch (e) {
    console.log("🚀 ~ SOL price cron job ~ Failed", e);
  }
};
