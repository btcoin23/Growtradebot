import TelegramBot from "node-telegram-bot-api";
import redisClient from "./redis";
import {
  ALERT_GB_IMAGE,
  ALERT_GT_IMAGE,
  AlertBotID,
  BridgeBotID,
  TradeBotID,
} from "../bot.opts";
// import { ReferralChannelController } from "../controllers/referral.channel";
import {
  getReferralList,
  get_referrer_info,
  update_channel_id,
} from "./referral.service";
import { ReferralIdenticalType } from "../main";
import {
  ReferralChannelService,
  ReferralPlatform,
} from "./referral.channel.service";

type ReferralChannel = {
  chat_id: string; // channel id
  channel_name: string;
};
export type ReferralData = {
  channels: ReferralChannel[];
  referral_code: string;
  creator: string;
  platform: ReferralPlatform; // TradeBot, BridgeBot
  schedule: string;
};

export const alertbotModule = async (bot: TelegramBot) => {
  try {
    const referrals = await getReferralList();

    if (!referrals) return;
    for (const referral of referrals) {
      processReferral(referral, bot);
    }
  } catch (e) {
    console.log("alertbotModule", e);
  }
};

const processReferral = async (referral: ReferralData, bot: TelegramBot) => {
  try {
    const { creator, referral_code, channels, platform, schedule } = referral;
    const scheduleInseconds = parseInt(schedule) * 60;
    const isValid = await validateSchedule(referral_code, scheduleInseconds);
    if (!isValid) return;

    const isTradeBot = Number(platform) === ReferralPlatform.TradeBot;
    for (let idx = 0; idx < channels.length; idx++) {
      const { chat_id } = channels[idx];

      sendAlert(bot, chat_id, referral_code, creator, idx, isTradeBot);
    }
  } catch (e) {
    console.log("processReferral", e);
  }
};

const sendAlert = async (
  bot: TelegramBot,
  channelChatId: string,
  referral_code: string,
  creator: string,
  idx: number,
  isTradeBot: boolean
) => {
  try {
    if (!channelChatId || channelChatId === "") return;
    await bot.getChat(channelChatId);

    const botId = isTradeBot ? TradeBotID : BridgeBotID;
    const botImg = isTradeBot ? ALERT_GT_IMAGE : ALERT_GB_IMAGE;
    const txt = isTradeBot ? "Try GrowTrade Now" : "Try GrowBridge Now";
    const referralLink = `https://t.me/${botId}?start=${referral_code}`;

    const inline_keyboard = [
      [
        {
          text: txt,
          url: referralLink,
        },
      ],
    ];
    if (isTradeBot) {
      inline_keyboard.push([
        {
          text: "Trade with us 📈",
          url: "https://t.me/GrowTradeOfficial",
        },
      ]);
    }

    bot.sendPhoto(channelChatId, botImg, {
      caption: "",
      reply_markup: {
        inline_keyboard,
      },
      parse_mode: "HTML",
    });
  } catch (error) {
    console.log("sendAlert Error:", channelChatId, referral_code);
    await handleError(error, creator, idx, channelChatId);
  }
};
const handleError = async (
  error: any,
  creator: string,
  idx: number,
  channelChatId: string
) => {
  try {
    const errMsg = error.response.body.description;
    if (errMsg.includes("chat not found")) {
      const lastNum: string | null = await redisClient.get(channelChatId);
      if (!lastNum) {
        await redisClient.set(channelChatId, "0");
        return;
      }
      const retryCounter = parseInt(lastNum) + 1;
      if (retryCounter <= 3) {
        await redisClient.set(channelChatId, retryCounter.toFixed(0));
        return;
      }
      await redisClient.del(channelChatId);

      const res = await update_channel_id(creator, idx, "delete");
      if (!res) {
        console.log("ServerError: cannot remove channel", creator, idx);
      }
    }
  } catch (e) {
    return;
  }
};
const validateSchedule = async (referral_code: string, schedule: number) => {
  try {
    const last_ts: string | null = await redisClient.get(referral_code);
    const timestamp = Date.now() / 1000;
    if (!last_ts) {
      await redisClient.set(referral_code, timestamp.toFixed(0));
      return true;
    }
    const last_timestamp = Number(last_ts);
    if (timestamp - last_timestamp > schedule) {
      await redisClient.set(referral_code, timestamp.toFixed(0));
      return true;
    }
    return false;
  } catch (e) {
    console.log("validateSchedule", e);
    return false;
  }
};

export const newReferralChannelHandler = async (msg: TelegramBot.Message) => {
  try {
    const { chat, from, new_chat_members } = msg;
    if (from && new_chat_members && from.username) {
      // if bot added me, return
      if (from.is_bot) return;
      // if me is bot??,
      const alertbotInfo = new_chat_members.find(
        (member) => member.username === AlertBotID
      );
      if (!alertbotInfo) return;

      const creator = from.username;
      // const refdata = await get_referrer_info(creator);
      // if (!refdata) return;
      // const referral_code = refdata.referral_code;
      const chat_id = chat.id;
      const channel_name = chat.title ?? "";

      return {
        chatId: chat_id.toString(),
        referrer: creator,
        channelName: channel_name,
        messageId: msg.message_id.toString(),
      } as ReferralIdenticalType;
      // await ReferralChannelController.create(
      //   creator,
      //   channel_name,
      //   chat_id.toString(),
      //   referral_code
      // )
    }
    return null;
  } catch (e) {
    console.log("newReferralChannelHandler", e);
    return null;
  }
};

export const removeReferralChannelHandler = async (
  msg: TelegramBot.Message
) => {
  try {
    const { chat, from, left_chat_member } = msg;
    if (from && left_chat_member && from.username) {
      // if bot added me, return
      if (from.is_bot) return;

      // if me is bot??,
      const alertbotInfo = left_chat_member.username === AlertBotID;
      if (!alertbotInfo) return;

      const creator = from.username;
      // const refdata = await get_referrer_info(creator);
      // if (!refdata) return;
      // const referral_code = refdata;
      const chat_id = chat.id;

      const referralChannelService = new ReferralChannelService();
      await referralChannelService.deleteReferralChannel({
        creator,
        // platform: ReferralPlatform.TradeBot,
        chat_id: chat_id.toString(),
        channel_name: chat.title,
      });
      // await ReferralChannelController.deleteOne({
      //   chat_id,
      //   referral_code
      // })
    }
  } catch (e) {
    console.log("newReferralChannelHandler", e);
  }
};

export const sendAlertForOurChannel = async (alertBot: TelegramBot) => {
  try {
    const chat_id = "-1002138253167";
    await alertBot.getChat(chat_id);
    await alertBot.sendPhoto(chat_id, ALERT_GT_IMAGE, {
      caption: "",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Try GrowBridge now!",
              url: `https://t.me/${TradeBotID}`,
            },
          ],
          // [{
          //   text: 'Start Trading With GrowTrade',
          //   url: "https://t.me/growtradeapp_bot"
          // }],
        ],
      },
      parse_mode: "HTML",
    });
  } catch (e) {
    console.log("Channel Error", e);
  }
};
