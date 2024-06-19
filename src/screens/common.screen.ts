import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";

export const closeReplyMarkup = {
  parse_mode: "HTML",
  disable_web_page_preview: true,
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "❌ Close",
          callback_data: JSON.stringify({
            command: "dismiss_message",
          }),
        },
      ],
    ],
  },
} as SendMessageOptions;

export const closeInlinekeyboardOpts = {
  text: "❌ Close",
  callback_data: JSON.stringify({
    command: "dismiss_message",
  }),
};

export const sendNoneUserNotification = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const { id: chat_id } = msg.chat;
  const sentMsg = await bot.sendMessage(
    chat_id,
    "⚠︎ Error\n<b>This account does not exist. Please contact support team.</b>",
    closeReplyMarkup
  );
  deleteDelayMessage(bot, chat_id, sentMsg.message_id, 5000);
};

export const sendNoneExistTokenNotification = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const { id: chat_id } = msg.chat;
  const sentMsg = await bot.sendMessage(
    chat_id,
    "⚠︎ Error\n<b>This token does not exist. Please verify the mint address again or try later.</b>",
    {
      parse_mode: "HTML",
    }
  );
  deleteDelayMessage(bot, chat_id, sentMsg.message_id, 5000);
};

export const sendInsufficientNotification = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const { id: chat_id } = msg.chat;
  const sentMsg = await bot.sendMessage(
    chat_id,
    "⚠︎ Error\n<b>Insufficient amount.</b>",
    {
      parse_mode: "HTML",
    }
  );
  deleteDelayMessage(bot, chat_id, sentMsg.message_id, 5000);
};

export const sendUsernameRequiredNotification = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const { id: chat_id } = msg.chat;
  const sentMsg = await bot.sendMessage(
    chat_id,
    "⚠︎ Error\n<b>You have no telegram username yourself. Please edit your profile and try it again.</b>",
    closeReplyMarkup
  );
};

// delay: ms
export const deleteDelayMessage = (
  bot: TelegramBot,
  chat_id: number,
  message_id: number,
  delay: number
) => {
  try {
    setTimeout(() => {
      bot.deleteMessage(chat_id, message_id);
    }, delay);
  } catch (e) {}
};
