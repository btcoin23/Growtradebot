import TelegramBot from "node-telegram-bot-api";
import redisClient from "./redis";
import { ALERT_MSG_IMAGE, AlertBotID, TradeBotID } from "../bot.opts";
import { ReferralChannelController } from "../controllers/referral.channel";
import { getReferralList, get_referrer_info, update_channel_id } from "./referral.service";

export type ReferralData = {
  username: string,
  uniquecode: string,
  schedule: string,
}


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
}

const processReferral = async (referral: ReferralData, bot: TelegramBot) => {
  try {
    const { username, uniquecode, schedule } = referral;
    const scheduleInseconds = parseInt(schedule) * 60;
    const isValid = await validateSchedule(uniquecode, scheduleInseconds)
    if (!isValid) return;
    const channels = await ReferralChannelController.find({ referral_code: uniquecode });

    const referralLink = `https://t.me/${TradeBotID}?start=${uniquecode}`;
    for (let idx = 0; idx < channels.length; idx++) {
      const { chat_id } = channels[idx];
      sendAlert(bot, chat_id, referralLink, username, idx);
    }
  } catch (e) {
    console.log("processReferral", e);
  }
}

const sendAlert = async (bot: TelegramBot, channelChatId: string, referralLink: string, username: string, idx: number) => {
  try {
    if (!channelChatId || channelChatId === "") return;
    await bot.getChat(channelChatId);
    bot.sendPhoto(
      channelChatId,
      ALERT_MSG_IMAGE,
      {
        caption: '',
        reply_markup: {
          inline_keyboard: [
            [{
              text: 'Try GrowTrade now!',
              url: referralLink
            }],
            // [{
            //   text: 'Start Trading With GrowTrade',
            //   url: "https://t.me/growtradeapp_bot"
            // }],
          ]
        },
        parse_mode: 'HTML',
      }
    )
  } catch (error) {
    console.log("sendAlert", channelChatId, referralLink);
    await handleError(error, username, idx, channelChatId);
  }
}
const handleError = async (error: any, username: string, idx: number, channelChatId: string) => {
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

      const res = await update_channel_id(
        username,
        idx,
        'delete',
      )
      if (!res) {
        console.log("ServerError: cannot remove channel", username, idx);
      }
    }
  } catch (e) {
    return;
  }
}
const validateSchedule = async (uniquecode: string, schedule: number) => {
  try {
    const last_ts: string | null = await redisClient.get(uniquecode);
    const timestamp = Date.now() / 1000;
    if (!last_ts) {
      await redisClient.set(uniquecode, timestamp.toFixed(0));
      return true;
    }
    const last_timestamp = Number(last_ts);
    if (timestamp - last_timestamp > schedule) {
      await redisClient.set(uniquecode, timestamp.toFixed(0));
      return true;
    }
    return false;
  } catch (e) {
    console.log("validateSchedule", e);
    return false;
  }
}

export const newReferralChannelHandler = async (msg: TelegramBot.Message) => {
  try {
    const { chat, from, new_chat_members } = msg;
    if (from && new_chat_members && from.username) {
      // if bot added me, return
      if (from.is_bot) return;

      // if me is bot??, 
      const alertbotInfo = new_chat_members.find(member => member.username === AlertBotID);
      if (!alertbotInfo) return;

      const creator = from.username;
      const refdata = await get_referrer_info(creator);

      if (!refdata) return;

      const referral_code = refdata.uniquecode;
      const chat_id = chat.id;
      const channel_name = chat.title ?? "";

      await ReferralChannelController.create(
        creator,
        channel_name,
        chat_id.toString(),
        referral_code
      )
    }
  } catch (e) {
    console.log("newReferralChannelHandler", e);
  }
}


export const removeReferralChannelHandler = async (msg: TelegramBot.Message) => {
  try {
    const { chat, from, left_chat_member } = msg;
    if (from && left_chat_member && from.username) {
      // if bot added me, return
      if (from.is_bot) return;

      // if me is bot??, 
      const alertbotInfo = left_chat_member.username === AlertBotID;
      if (!alertbotInfo) return;

      const creator = from.username;
      const refdata = await get_referrer_info(creator);

      if (!refdata) return;
      const referral_code = refdata;
      const chat_id = chat.id;

      await ReferralChannelController.deleteOne({
        chat_id,
        referral_code
      })
    }
  } catch (e) {
    console.log("newReferralChannelHandler", e);
  }
}

export const sendAlertForOurChannel = async (alertBot: TelegramBot) => {
  try {
    const chat_id = "-1002138253167";
    await alertBot.getChat(chat_id);
    console.log("send message ==>");
    await alertBot.sendPhoto(
      chat_id,
      ALERT_MSG_IMAGE,
      {
        caption: '',
        reply_markup: {
          inline_keyboard: [
            [{
              text: 'Try GrowBridge now!',
              url: `https://t.me/${TradeBotID}`
            }],
            // [{
            //   text: 'Start Trading With GrowTrade',
            //   url: "https://t.me/growtradeapp_bot"
            // }],
          ]
        },
        parse_mode: 'HTML',
      }
    )
  } catch (e) {
    console.log("Channel Error", e)
  }
}