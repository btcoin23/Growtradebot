import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api"
import { TokenService } from "../services/token.metadata";
import { copytoclipboard } from "../utils";
import { UserService } from "../services/user.service";
import { sendUsernameRequiredNotification } from "./common.screen";
import { GrowTradeVersion } from "../config";
import { NATIVE_MINT } from "@solana/spl-token";

export const buySellScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  // replaceId: number
) => {
  try {
    const { chat, } = msg;
    const { id: chat_id, username } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const user = await UserService.findOne({ username });
    if (!user) return;


    const temp = `GrowTrade ${GrowTradeVersion}\n💳 <b>Your wallet address</b>\n` +
      `<i>${copytoclipboard(user.wallet_address)}</i>\n\n` +
      `<b>Loading...</b>\n`;

    const reply_markup = {
      inline_keyboard: [
        [{
          text: '❌ Close', callback_data: JSON.stringify({
            'command': 'dismiss_message'
          })
        }]
      ]
    }

    // bot.editMessageText(
    //   temp,
    //   {
    //     message_id: replaceId,
    //     chat_id,
    //     parse_mode: 'HTML',
    //     disable_web_page_preview: true,
    //     reply_markup
    //   }
    // );
    const sentMessage = await bot.sendMessage(
      chat_id,
      temp,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      }
    )

    const tokenaccounts = await TokenService.getTokenAccounts(user.wallet_address);

    let caption = `GrowTrade ${GrowTradeVersion}\n💳 <b>Your wallet address</b>\n` +
      `<i>${copytoclipboard(user.wallet_address)}</i>\n\n` +
      `<b>Please choose a token to buy/sell.</b>\n\n`;

    // Initialize the transferInlineKeyboards array with an empty array
    const transferInlineKeyboards: InlineKeyboardButton[][] = [];

    let idx = 0;
    tokenaccounts.forEach(item => {
      const { mint: mintAddress, amount: tokenBalance, symbol } = item;
      caption += `\n- <b>Token: ${tokenBalance} ${symbol}</b>\n<i>${copytoclipboard(mintAddress)}</i>\n`;

      // Check if the current nested array exists
      if (!transferInlineKeyboards[Math.floor(idx / 3)]) {
        transferInlineKeyboards.push([]);
      }

      // Push the new inline keyboard button to the appropriate nested array
      transferInlineKeyboards[Math.floor(idx / 3)].push({
        text: `${symbol ? symbol : mintAddress}`,
        callback_data: JSON.stringify({
          'command': `BS_${mintAddress}`
        })
      });

      idx++;
    });
    if (tokenaccounts.length <= 0) {
      transferInlineKeyboards.push([]);
      caption += '<i>You have no any token</i>';
    }
    transferInlineKeyboards[Math.floor(tokenaccounts.length / 3)].push(
      {
        text: '❌ Close', callback_data: JSON.stringify({
          'command': 'dismiss_message'
        })
      }
    );

    const new_reply_markup = {
      inline_keyboard: transferInlineKeyboards
    }
    bot.editMessageText(
      caption,
      {
        message_id: sentMessage.message_id,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: new_reply_markup
      }
    )
  } catch (e) {
    console.log("~ TransferFundScreenHandler~", e);
  }
}
