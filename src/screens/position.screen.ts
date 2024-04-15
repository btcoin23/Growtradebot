import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api"
import { TokenService } from "../services/token.metadata";
import { copytoclipboard } from "../utils";
import { UserService } from "../services/user.service";
import { sendUsernameRequiredNotification } from "./common.screen";
import { GrowTradeVersion } from "../config";
import { PositionService } from "../services/position.service";

export const positionScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  replaceId?: number
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

    let replaceIdtemp = replaceId;
    if (replaceId) {
      await bot.editMessageText(
        temp,
        {
          message_id: replaceId,
          chat_id,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup
        }
      );
    } else {
      const sentMessage = await bot.sendMessage(
        chat_id,
        temp,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup
        }
      )
      replaceIdtemp = sentMessage.message_id;
    }

    const tokenaccounts = await TokenService.getTokenAccounts(user.wallet_address);
    const solprice = await TokenService.getSOLPrice();

    let caption = `GrowTrade ${GrowTradeVersion}\n💳 <b>Your wallet address</b>\n` +
      `<i>${copytoclipboard(user.wallet_address)}</i>\n\n` +
      `<b>Please choose a token to buy/sell.</b>\n`;

    // Initialize the transferInlineKeyboards array with an empty array
    const transferInlineKeyboards: InlineKeyboardButton[][] = [];
    const positions = await PositionService.find({ wallet_address: user.wallet_address });
    let idx = 0;
    for (const item of tokenaccounts) {
      const { mint: mintAddress, amount: tokenBalance, symbol, price, transferFeeData, transferFeeEnable } = item;
      caption += `\n- <b>Token: ${symbol}</b>\n<b>Amount: ${tokenBalance}</b>\n`;
      const position = positions.filter(ps => ps.mint === mintAddress);
      if (position.length > 0) {
        const { sol_amount } = position[0];
        if (sol_amount > 0) {
          let pnl = (price / solprice * tokenBalance * 100) / sol_amount;
          if (transferFeeEnable && transferFeeData) {
            const feerate = 1 - transferFeeData.newer_transfer_fee.transfer_fee_basis_points / 10000.0;
            pnl *= feerate;
          }
          if (pnl >= 100) {
            let pnl_sol = ((pnl - 100) * sol_amount / 100).toFixed(4);
            let pnl_dollar = ((pnl - 100) * sol_amount * solprice / 100).toFixed(2)
            caption += `<b>PNL:</b> +${(pnl - 100).toFixed(2)}% [${pnl_sol} Sol | +${pnl_dollar}$] 🟩\n\n`
          } else {
            let pnl_sol = ((100 - pnl) * sol_amount / 100).toFixed(4);
            let pnl_dollar = ((100 - pnl) * sol_amount * solprice / 100).toFixed(2)
            caption += `<b>PNL:</b> -${(100 - pnl).toFixed(2)}% [${pnl_sol} Sol | -${pnl_dollar}$] 🟥\n\n`
          }
        }
      }
      caption += `<i>${copytoclipboard(mintAddress)}</i>\n`;
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
    }

    if (tokenaccounts.length <= 0) {
      transferInlineKeyboards.push([]);
      caption += `\n<i>You don't hold any tokens in this wallet</i>`;
    }
    transferInlineKeyboards.push([]);
    transferInlineKeyboards[Math.ceil(tokenaccounts.length / 3)].push(...[
      {
        text: '🔄 Refresh', callback_data: JSON.stringify({
          'command': 'pos_ref'
        })
      },
      {
        text: '❌ Close', callback_data: JSON.stringify({
          'command': 'dismiss_message'
        })
      }
    ]);

    const new_reply_markup = {
      inline_keyboard: transferInlineKeyboards
    }
    const sentmessage = await bot.editMessageText(
      caption,
      {
        message_id: replaceIdtemp,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: new_reply_markup
      }
    )
  } catch (e) {
    console.log("~ positionScreenHandler~", e);
  }
}
