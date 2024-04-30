import TelegramBot from "node-telegram-bot-api";
import { ALERT_BOT_IMAGE, AlertBotID, WELCOME_REFERRAL } from "../bot.opts";
import { get_referrer_info } from "../services/referral.service";
import { ReferralChannelController } from "../controllers/referral.channel";
import { UserService } from "../services/user.service";
import { schedule } from "node-cron";

export const openAlertBotDashboard = async (
  bot: TelegramBot,
  chat: TelegramBot.Chat,
) => {
  try {
    const chatId = chat.id;
    const username = chat.username;

    if (!username) return;
    const refdata = await get_referrer_info(username);
    if (!refdata) {
      bot.sendMessage(chat.id, 'You have no referral code. Please create a referral code first.');
      return;
    }

    const { schedule, uniquecode } = refdata;

    const channels = await ReferralChannelController.find({ referral_code: uniquecode })

    const inlineKeyboards = [
      [{
        text: 'Alert Schedule 🕓',
        callback_data: JSON.stringify({
          'command': 'alert_schedule'
        })
      }, {
        text: 'Invite AlertBot 🤖',
        callback_data: JSON.stringify({
          'command': 'dummy_button'
        })
        // url: `https://t.me/${AlertBotID}?startgroup=true`
      }],
      [{
        text: 'Refresh bot info',
        callback_data: JSON.stringify({
          'command': 'refresh_alert_bot'
        })
      }, {
        text: 'Back',
        callback_data: JSON.stringify({
          'command': 'back_from_ref'
        })
      }],
    ];

    const reply_markup = {
      inline_keyboard: inlineKeyboards,
    }

    let channelList = ``;
    for (const channel of channels) {
      const { channel_name } = channel;
      channelList += `🟢 ${channel_name}\n`;
    }

    if (channels.length <= 0) {
      channelList += 'You have not invited our alert bot into any channel yet.\n'
    }
    const contents = `<b>AlertBot Configuration</b>\n\n` +
      `<b>Channels</b>\n` +
      `${channelList}\n` +
      '<b>Alert schedule</b>\n' +
      `Bot will send alerts every <b>${schedule ?? 30}</b> minutes.\n\n` +
      `Once you setup at least one group, you can then invite @${AlertBotID} into your group-chat.\n\n` +
      `If you want to update the settings, you can do it through the menu down below 👇🏼`;
    await bot.sendPhoto(
      chatId,
      WELCOME_REFERRAL,
      {
        caption: contents,
        reply_markup,
        parse_mode: 'HTML'
      });

  } catch (e) {
    console.log("~ openAlertBotDashboard Error ~", e)
  }
}

export const sendMsgForAlertScheduleHandler = async (
  bot: TelegramBot,
  chat: TelegramBot.Chat,
) => {
  try {
    if (!chat.username) return;
    const msgText = `Please, set a time alert frequency 👇🏼.`;

    const inlineKeyboards = [
      [{
        text: '10mins',
        callback_data: JSON.stringify({
          'command': 'schedule_time_10'
        })
      }, {
        text: '30mins',
        callback_data: JSON.stringify({
          'command': 'schedule_time_30'
        })
      }],
      [{
        text: '1h',
        callback_data: JSON.stringify({
          'command': 'schedule_time_60'
        })
      }, {
        text: '3h',
        callback_data: JSON.stringify({
          'command': 'schedule_time_180'
        })
      }, {
        text: '4h',
        callback_data: JSON.stringify({
          'command': 'schedule_time_240'
        })
      }, {
        text: '6h',
        callback_data: JSON.stringify({
          'command': 'schedule_time_360'
        })
      }],
    ];

    const reply_markup = {
      inline_keyboard: inlineKeyboards,
    };

    await bot.sendMessage(
      chat.id,
      msgText,
      {
        reply_markup,
        parse_mode: "HTML"
      }
    );
  } catch (e) {
    console.log("sendMsgForChannelIDHandler", e)
  }
}

export const updateSchedule = async (bot: TelegramBot, chat: TelegramBot.Chat, scheduleTime: string) => {
  try {
    const chatId = chat.id;
    const username = chat.username;
    if (!username) return;
    // post
    const res = await UserService.findAndUpdateOne({ username: username }, { schedule: scheduleTime })
    if (res) {
      bot.sendMessage(chatId, "Successfully updated!");
    } else {
      bot.sendMessage(chatId, "Update schedule failed! Try it again");
    }
  } catch (e) {
    console.log("updateSchedule", e);
  }
}
