import TelegramBot, { KeyboardButton, ReplyKeyboardMarkup } from "node-telegram-bot-api";
import { TradeBotID, WELCOME_REFERRAL } from "../bot.opts";
import { copytoclipboard } from "../utils";
import { get_referral_num } from "../services/referral.service";

export const showWelcomeReferralProgramMessage = async (
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  uniquecode?: string
) => {
  try {
    const chatId = chat.id;
    const inlineKeyboards = [
      [{
        text: 'Manage payout 📄',
        callback_data: JSON.stringify({
          'command': 'payout_address'
        })
      }],
      [{
        text: 'Set up Alert Bot 🤖',
        callback_data: JSON.stringify({
          'command': 'alert_bot'
        })
      }, {
        text: `❌ Close`,
        callback_data: JSON.stringify({
          'command': 'dismiss_message'
        })
      }
      ],

    ]
    if (!uniquecode || uniquecode === "") {
      const reply_markup = {
        inline_keyboard: [
          [{
            text: 'Create a referral code 💰',
            callback_data: JSON.stringify({
              'command': 'create_referral_code'
            })
          }],
          ...inlineKeyboards
        ],
      }


      const caption = `<b>🎉 Welcome to the referral program</b>\n\n` +
        `Please create a unique referral code to get started👇.`;
      await bot.sendPhoto(
        chatId,
        WELCOME_REFERRAL,
        {
          caption: caption,
          reply_markup,
          parse_mode: 'HTML'
        }
      );
    } else {
      const reply_markup = {
        inline_keyboard: inlineKeyboards,
      };
      let num = await get_referral_num(uniquecode);
      const referralLink = `https://t.me/${TradeBotID}?start=${uniquecode}`;
      const contents = '<b>🎉 Welcome to referral program</b>\n\n' +
        `<b>Refer your friends and earn 25% of their fees in the first 45 days, 20% in the next 45 days and 15% forever!</b>\n\n` +
        `<b>Referred Count: ${num.num}\nSol Earned: 0</b>\n\n` +
        `<b>Your referral code 🔖</b>\n${copytoclipboard(uniquecode)}\n\n` +
        `<b>Your referral link 🔗</b>\n${copytoclipboard(referralLink)}\n\n` +
        `- Share your referral link with whoever you want and earn from their swaps 🔁\n` +
        `- Check profits, payouts and change the payout address 📄\n`

      await bot.sendPhoto(
        chatId,
        WELCOME_REFERRAL,
        {
          caption: contents,
          reply_markup,
          parse_mode: 'HTML'
        }
      );
    }
  } catch (e) {
    console.log("~ showWelcomeReferralProgramMessage Error ~", e)
  }
}