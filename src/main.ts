import TelegramBot from "node-telegram-bot-api";
import { PNL_IMG_GENERATOR_API, TELEGRAM_BOT_API_TOKEN } from "./config";
import { AlertBotID, BotMenu } from "./bot.opts";
import { WelcomeScreenHandler } from "./screens/welcome.screen";
import { callbackQueryHandler } from "./controllers/callback.handler";
import { messageHandler } from "./controllers/message.handler";
import { positionScreenHandler } from "./screens/position.screen";
import { UserService } from "./services/user.service";
import {
  alertBot,
  runAlertBotForChannel,
  runAlertBotSchedule,
} from "./cron/alert.bot.cron";
import {
  newReferralChannelHandler,
  removeReferralChannelHandler,
} from "./services/alert.bot.module";
import { runSOLPriceUpdateSchedule } from "./cron/sol.price.cron";
import { settingScreenHandler } from "./screens/settings.screen";
import {
  ReferralChannelService,
  ReferralPlatform,
} from "./services/referral.channel.service";
import { ReferrerListService } from "./services/referrer.list.service";
import { runListener } from "./raydium";
import { wait } from "./utils/wait";
import { runOpenmarketCronSchedule } from "./cron/remove.openmarket.cron";

const token = TELEGRAM_BOT_API_TOKEN;

if (!token) {
  throw new Error(
    "TELEGRAM_BOT API_KEY is not defined in the environment variables"
  );
}

export interface ReferralIdenticalType {
  referrer: string;
  chatId: string;
  messageId: string;
  channelName: string;
}

const startTradeBot = () => {
  const bot = new TelegramBot(token, { polling: true });
  //
  runOpenmarketCronSchedule();
  // Listen Raydium POOL creation
  runListener();
  // bot menu
  runAlertBotSchedule();
  // Later: runAlertBotForChannel();
  runSOLPriceUpdateSchedule();
  bot.setMyCommands(BotMenu);

  // bot callback
  bot.on(
    "callback_query",
    async function onCallbackQuery(callbackQuery: TelegramBot.CallbackQuery) {
      callbackQueryHandler(bot, callbackQuery);
    }
  );

  // bot message
  bot.on("message", async (msg: TelegramBot.Message) => {
    messageHandler(bot, msg);
  });

  // bot commands
  bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    // Need to remove "/start" text
    bot.deleteMessage(msg.chat.id, msg.message_id);

    await WelcomeScreenHandler(bot, msg);
    const referralcode = UserService.extractUniqueCode(msg.text ?? "");
    if (referralcode && referralcode !== "") {
      // store info
      const chat = msg.chat;
      if (chat.username) {
        const data = await UserService.findLastOne({ username: chat.username });
        if (data && data.referral_code && data.referral_code !== "") return;
        await UserService.updateMany(
          { username: chat.username },
          {
            referral_code: referralcode,
            referral_date: new Date(),
          }
        );
      }
    }
  });
  bot.onText(/\/position/, async (msg: TelegramBot.Message) => {
    await positionScreenHandler(bot, msg);
  });

  bot.onText(/\/settings/, async (msg: TelegramBot.Message) => {
    await settingScreenHandler(bot, msg);
  });

  alertBot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    const { from, chat, text, message_id } = msg;
    console.log("AlertBotStart", `/start@${AlertBotID}`);
    if (text && text.includes(`/start@${AlertBotID}`)) {
      console.log("AlertBotStart Delete", Date.now());
      await wait(3000);
      console.log("AlertBotStart Delete", Date.now());

      try {
        alertBot.deleteMessage(chat.id, message_id);
      } catch (e) {}
      if (!from) return;
      if (!text.includes(" ")) return;
      const referrerInfo = await ReferrerListService.findLastOne({
        referrer: from.username,
        chatId: chat.id.toString(),
      });
      if (!referrerInfo) return;
      // for (const referrerInfo of referrerList) {
      const { referrer, chatId, channelName } = referrerInfo;
      // if (referrer === from.username && chat.id.toString() === chatId) {
      const parts = text.split(" ");
      if (parts.length < 1) {
        return;
      }
      if (parts[0] !== `/start@${AlertBotID}`) {
        return;
      }
      const botType = parts[1];
      if (botType === "tradebot") {
        const referralChannelService = new ReferralChannelService();
        await referralChannelService.addReferralChannel({
          creator: referrer,
          platform: ReferralPlatform.TradeBot,
          chat_id: chatId,
          channel_name: channelName,
        });
      } else if (botType === "bridgebot") {
        const referralChannelService = new ReferralChannelService();
        await referralChannelService.addReferralChannel({
          creator: referrer,
          platform: ReferralPlatform.BridgeBot,
          chat_id: chatId,
          channel_name: channelName,
        });
      }
      // }
      // }
    }
  });
  alertBot.on("new_chat_members", async (msg: TelegramBot.Message) => {
    console.log("new Members", msg);
    const data = await newReferralChannelHandler(msg);
    if (!data) return;

    try {
      console.log("New member created");
      await ReferrerListService.create(data);
      console.log("New member added ended");
    } catch (e) {}
  });
  alertBot.on("left_chat_member", async (msg: TelegramBot.Message) => {
    await removeReferralChannelHandler(msg);
  });
};

export default startTradeBot;
