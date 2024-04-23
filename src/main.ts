import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_BOT_API_TOKEN } from "./config";
import { AlertBotID, BotMenu } from "./bot.opts";
import { WelcomeScreenHandler } from "./screens/welcome.screen";
import { callbackQueryHandler } from "./controllers/callback.handler";
import { messageHandler } from "./controllers/message.handler";
import { positionScreenHandler } from "./screens/position.screen";
import { UserService } from "./services/user.service";
import { alertBot, runAlertBotForChannel, runAlertBotSchedule } from "./cron/alert.bot.cron";
import { newReferralChannelHandler, removeReferralChannelHandler } from "./services/alert.bot.module";

const token = TELEGRAM_BOT_API_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT API_KEY is not defined in the environment variables');
}
const startTradeBot = () => {
  const bot = new TelegramBot(token, { polling: true });
  // bot menu
  runAlertBotSchedule();
  runAlertBotForChannel();
  bot.setMyCommands(BotMenu);


  // bot callback
  bot.on('callback_query', async function onCallbackQuery(callbackQuery: TelegramBot.CallbackQuery) {
    callbackQueryHandler(bot, callbackQuery);
  });

  // bot message
  bot.on('message', async (msg: TelegramBot.Message) => {
    messageHandler(bot, msg);
  });

  // bot commands
  bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    // https://t.me/growswapver1_bot?start=mqMyH7jKzWN3tNA
    const referralcode = UserService.extractUniqueCode(msg.text ?? "");
    if (referralcode && referralcode !== "") {
      // store info
      const chat = msg.chat;
      if (chat.username) {
        await UserService.findAndUpdateOne({ username: chat.username }, {
          referral_code: referralcode,
          referral_date: new Date()
        });
      }
    }
    await WelcomeScreenHandler(bot, msg);
  });
  bot.onText(/\/position/, async (msg: TelegramBot.Message) => {
    await positionScreenHandler(bot, msg);
  });

  alertBot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    if (msg.text && msg.text.includes(`/start@${AlertBotID}`)) {
      alertBot.deleteMessage(msg.chat.id, msg.message_id);
    }
  });
  alertBot.on('new_chat_members', async (msg: TelegramBot.Message) => {
    await newReferralChannelHandler(msg);
  });
  alertBot.on('left_chat_member', async (msg: TelegramBot.Message) => {
    await removeReferralChannelHandler(msg);
  });
}

export default startTradeBot;