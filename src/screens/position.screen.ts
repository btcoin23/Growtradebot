import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api"
import { TokenService } from "../services/token.metadata";
import { copytoclipboard } from "../utils";
import { UserService } from "../services/user.service";
import { sendUsernameRequiredNotification } from "./common.screen";
import { GrowTradeVersion, PNL_SHOW_THRESHOLD_USD } from "../config";
import { PositionService } from "../services/position.service";
import { JupiterService } from "../services/jupiter.service";
import { NATIVE_MINT } from "@solana/spl-token";
import { PNLService } from "../services/pnl.service";

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


    const temp = `<b>GrowTrade ${GrowTradeVersion}</b>\n💳 <b>Your wallet address</b>\n` +
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
    // const solprice = await TokenService.getSOLPrice();
    const solbalance = await TokenService.getSOLBalance(user.wallet_address);

    let caption = `<b>GrowTrade ${GrowTradeVersion}</b>\n💳 <b>Your wallet address</b>\n` +
      `<i>${copytoclipboard(user.wallet_address)}</i>\n\n` +
      `💳 Balance: <b>${solbalance} SOL</b>\n\n` +
      `<b>Please choose a token to buy/sell.</b>\n`;

    // Initialize the transferInlineKeyboards array with an empty array
    const transferInlineKeyboards: InlineKeyboardButton[][] = [];
    // const positions = await PositionService.find({ wallet_address: user.wallet_address });
    let idx = 0;
    let discount = 0;
    for (const item of tokenaccounts) {
      const { mint: mintAddress, amount: tokenBalance, symbol, price, decimals } = item;
      if (symbol === "SOL" || tokenBalance < 0.000005) {
        discount = -1;
        continue;
      }
      if (price && price * tokenBalance < 1) {
        discount = -1;
        continue;
      }
      caption += `\n- <b>Token: ${symbol}</b>\n<b>Amount: ${tokenBalance}</b>\n`;
      // const position = positions.filter(ps => ps.mint === mintAddress);
      // const splvalue = tokenBalance * price;

      // If value is over 5$.
      // const jupiterService = new JupiterService();
      // const quote = splvalue > PNL_SHOW_THRESHOLD_USD ? await jupiterService.getQuote(
      //   mintAddress,
      //   NATIVE_MINT.toBase58(),
      //   tokenBalance,
      //   decimals,
      //   9
      // ) : null;
      // if (quote) {
      //   const { wallet_address } = user;
      //   const pnlService = new PNLService(
      //     wallet_address,
      //     mintAddress,
      //     quote
      //   )
      //   await pnlService.initialize();
      //   const pnldata = await pnlService.getPNLInfo();
      //   if (pnldata) {
      //     const { profitInSOL, percent } = pnldata;
      //     const profitInUSD = profitInSOL * Number(solprice);
      //     if (profitInSOL < 0) {
      //       caption += `<b>PNL:</b> ${percent.toFixed(3)}% [${profitInSOL.toFixed(3)} Sol | ${profitInUSD.toFixed(2)}$] 🟥\n`
      //     } else {
      //       caption += `<b>PNL:</b> +${percent.toFixed(3)}% [${profitInSOL.toFixed(3)} Sol | ${profitInUSD.toFixed(2)}$] 🟩\n`
      //     }
      //   }
      // } else {
      //   caption += `<b>PNL:</b> 0%\n`
      // }
      // if (sol_amount > 0) {
      //   let pnl = (price / solprice * tokenBalance * 100) / sol_amount;
      //   if (transferFeeEnable && transferFeeData) {
      //     const feerate = 1 - transferFeeData.newer_transfer_fee.transfer_fee_basis_points / 10000.0;
      //     pnl *= feerate;
      //   }
      //   if (pnl >= 100) {
      //     let pnl_sol = ((pnl - 100) * sol_amount / 100).toFixed(4);
      //     let pnl_dollar = ((pnl - 100) * sol_amount * solprice / 100).toFixed(2)
      //     caption += `<b>PNL:</b> +${(pnl - 100).toFixed(2)}% [${pnl_sol} Sol | +${pnl_dollar}$] 🟩\n\n`
      //   } else {
      //     let pnl_sol = ((100 - pnl) * sol_amount / 100).toFixed(4);
      //     let pnl_dollar = ((100 - pnl) * sol_amount * solprice / 100).toFixed(2)
      //     caption += `<b>PNL:</b> -${(100 - pnl).toFixed(2)}% [${pnl_sol} Sol | -${pnl_dollar}$] 🟥\n\n`
      //   }
      // }
      caption += `<i>${copytoclipboard(mintAddress)}</i>\n`;
      // Check if the current nested array exists
      if (!transferInlineKeyboards[Math.floor(idx / 3)]) {
        transferInlineKeyboards.push([]);
      }

      // Push the new inline keyboard button to the appropriate nested array
      transferInlineKeyboards[Math.floor(idx / 3)].push({
        text: `${symbol ? symbol : mintAddress}`,
        callback_data: JSON.stringify({
          'command': `SPS_${mintAddress}`
        })
      });

      idx++;
    }

    if (tokenaccounts.length + discount <= 0) {
      transferInlineKeyboards.push([]);
      caption += `\n<i>You don't hold any tokens in this wallet</i>`;
    }
    transferInlineKeyboards.push([]);
    transferInlineKeyboards[Math.ceil((tokenaccounts.length + discount) / 3)].push(...[
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
