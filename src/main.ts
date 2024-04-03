import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_BOT_API_TOKEN } from "./config";
import { BotMenu } from "./bot.opts";
import { WelcomeScreenHandler } from "./screens/welcome.screen";
import { callbackQueryHandler } from "./controllers/callback.handler";
import { messageHandler } from "./controllers/message.handler";

const token = TELEGRAM_BOT_API_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT API_KEY is not defined in the environment variables');
}
const startTradeBot = () => {
  const bot = new TelegramBot(token, { polling: true });
  // bot menu
  bot.setMyCommands(BotMenu);


  // bot callback
  bot.on('callback_query', async function onCallbackQuery(callbackQuery: TelegramBot.CallbackQuery) {
    console.log("callback query");
    callbackQueryHandler(bot, callbackQuery);
  });

  // bot message
  bot.on('message', async (msg: TelegramBot.Message) => {
    console.log("monitor message");
    messageHandler(bot, msg);
  });

  // bot commands
  bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    console.log("start comand");
    await WelcomeScreenHandler(bot, msg);
  });
}

export default startTradeBot;