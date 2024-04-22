import TelegramBot from "node-telegram-bot-api";
import { alertbotModule, sendAlertForOurChannel } from "../services/alert.bot.module";
import cron from "node-cron";
import { ALERT_BOT_TOKEN_SECRET } from "../config";

const alertBotToken = ALERT_BOT_TOKEN_SECRET;
if (!alertBotToken) {
  throw new Error('API_KEY is not defined in the environment variables');
}

export const alertBot = new TelegramBot(alertBotToken, { polling: true });

const EVERY_1_MIN = "*/1 * * * *"
export const runAlertBotSchedule = () => {
  try {
    cron
      .schedule(EVERY_1_MIN, () => {
        alertbotModule(alertBot);
      })
      .start();
  } catch (error) {
    console.error(`Error running the Schedule Job for fetching the chat data: ${error}`);
  }
};

const EVERY_10_MIN = "0 * * * *"
export const runAlertBotForChannel = () => {
  try {
    cron
      .schedule(EVERY_10_MIN, () => {
        sendAlertForOurChannel(alertBot);
      })
      .start();
  } catch (error) {
    console.error(`Error running the Schedule Job for fetching the chat data: ${error}`);
  }
};


