import TelegramBot from "node-telegram-bot-api"
import { TokenService } from "../services/token.metadata";
import { birdeyeLink, contractLink, copytoclipboard, dexscreenerLink, dextoolLink, formatKMB, formatNumber, formatPrice, getPrice } from "../utils";
import { UserService } from "../services/user.service";
import { sendNoneExistTokenNotification, sendNoneUserNotification, sendUsernameRequiredNotification } from "./common.screen";
import { GasFeeEnum, UserTradeSettingService } from "../services/user.trade.setting.service";
import { MsgLogService } from "../services/msglog.service";
import { PositionService } from "../services/position.service";
import { autoBuyHandler, buyHandler } from "./trade.screen";

export const inline_keyboards = [
  [{ text: "Gas: 0.000105 SOL", command: null }],
  [{ text: "Slippage: 5%", command: 'set_slippage' }],
  [{ text: "Buy 0.01 SOL", command: 'buytoken_0.01' }, { text: "Buy 1 SOL", command: 'buytoken_1' },],
  [{ text: "Buy 5 SOL", command: 'buytoken_5' }, { text: "Buy 10 SOL", command: 'buytoken_10' },],
  [{ text: "Buy X SOL", command: 'buy_custom' }],
  [{ text: "🔁 Switch To Sell", command: "SS_" }],
  [{ text: "🔄 Refresh", command: 'refresh' }, { text: "❌ Close", command: 'dismiss_message' }]
]

export const contractInfoScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message, mint: string, switchBtn?: string) => {
  try {
    const { id: chat_id, username } = msg.chat;

    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    // user
    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }

    let preset_setting = user.preset_setting ?? [0.01, 1, 5, 10];

    if (switchBtn == "switch_buy") {
      inline_keyboards[2] = [{ text: "Sell 10%", command: `selltoken_10` }, { text: "Sell 50%", command: `selltoken_50` },]
      inline_keyboards[3] = [{ text: "Sell 75%", command: `selltoken_75` }, { text: "Sell 100%", command: `selltoken_100` },]
      inline_keyboards[4] = [{ text: "Sell X%", command: `sell_custom` }]
      inline_keyboards[5] = [{ text: "🔁 Switch To Buy", command: `SS_${mint}` }]
    } else {
      inline_keyboards[2] = [{ text: `Buy ${preset_setting[0]} SOL`, command: `buytoken_${preset_setting[0]}` }, { text: `Buy ${preset_setting[1]} SOL`, command: `buytoken_${preset_setting[1]}` },]
      inline_keyboards[3] = [{ text: `Buy ${preset_setting[2]} SOL`, command: `buytoken_${preset_setting[2]}` }, { text: `Buy ${preset_setting[3]} SOL`, command: `buytoken_${preset_setting[3]}` },]
      inline_keyboards[4] = [{ text: `Buy X SOL`, command: `buy_custom` }]
      inline_keyboards[5] = [{ text: `🔁 Switch To Sell`, command: `BS_${mint}` }]
    }

    // check token metadata
    const tokeninfo = await TokenService.getMintInfo(mint);
    if (!tokeninfo) {
      // await sendNoneExistTokenNotification(bot, msg);
      return;
    }

    const { overview, secureinfo } = tokeninfo;
    const { symbol, name, price, mc, liquidity } = overview;
    const { isToken2022, ownerAddress, freezeAuthority, transferFeeEnable, transferFeeData, top10HolderBalance, top10HolderPercent } = secureinfo;

    let caption = `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${copytoclipboard(mint)}</i>\n\n`;

    const solprice = await TokenService.getSOLPrice();
    const splbalance = await TokenService.getSPLBalance(mint, user.wallet_address, isToken2022, true);
    const solbalance = await TokenService.getSOLBalance(user.wallet_address);

    let priceImpact = ((1 - (liquidity) / (liquidity + splbalance)) * 100).toFixed(2);
    const position = await PositionService.findOne({ wallet_address: user.wallet_address, mint });
    if (position) {
      const { sol_amount } = position;
      if (sol_amount > 0) {
        let pnl = (price / solprice * splbalance * 100) / sol_amount;

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

    caption += `🌳 Mint Disabled: ${ownerAddress ? "🔴" : "🍏"}\n` +
      `👥 Top 10 holder: ${top10HolderPercent && (top10HolderPercent > 0.15 ? '🟥' : '🍏')}  [ ${top10HolderPercent && (top10HolderPercent * 100)?.toFixed(2)}% held ]\n` +
      // `🌳 Freeze Disabled: ${freezeAuthority ? "🔴" : "🍏"}\n\n` +
      `💲 Price: <b>$${formatPrice(price)}</b>\n` +
      `💸 Price Impact: [${priceImpact} % of price impact if sold]\n` +
      `📊 Market Cap: <b>$${formatKMB(mc)}</b>\n\n` +
      `💳 <b>Balance: loading... </b>\n` +
      `${contractLink(mint)} • ${birdeyeLink(mint)} • ${dextoolLink(mint)} • ${dexscreenerLink(mint)}`;

    const slippageSetting = await UserTradeSettingService.getSlippage(username, mint);
    const gasSetting = await UserTradeSettingService.getGas(username);
    const { slippage } = slippageSetting;

    const gaskeyboards = await UserTradeSettingService.getGasInlineKeyboard(gasSetting.gas);
    const gasvalue = UserTradeSettingService.getGasValue(gasSetting);

    inline_keyboards[0][0] = {
      text: `${gasSetting.gas === GasFeeEnum.CUSTOM ? "🟢" : ""} Gas: ${gasvalue} SOL ⚙️`,
      command: 'custom_fee'
    }
    inline_keyboards[1][0].text = `Slippage: ${slippage} %`;

    if (switchBtn) {
      const sentMessage = bot.editMessageReplyMarkup(
        {
          inline_keyboard: [gaskeyboards, ...inline_keyboards].map((rowItem) => rowItem.map((item) => {
            return {
              text: item.text,
              callback_data: JSON.stringify({
                'command': item.command ?? "dummy_button"
              })
            }
          })),
        },
        {
          message_id: msg.message_id,
          chat_id,
        }
      );
      await MsgLogService.create({
        username,
        mint,
        wallet_address: user.wallet_address,
        chat_id,
        msg_id: msg.message_id,
        sol_amount: solbalance,
        spl_amount: splbalance,
        extra_key: switchBtn
      });
      // await MsgLogService.findOneAndUpdate({
      //   filter: {
      //     username,
      //     mint,
      //     wallet_address: user.wallet_address,
      //     chat_id,
      //     msg_id: msg.message_id,
      //   },
      //   data: {
      //     extra_key: switchBtn
      //   }
      // });
    } else {
      const sentMessage = await bot.sendMessage(
        chat_id,
        caption,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [gaskeyboards, ...inline_keyboards].map((rowItem) => rowItem.map((item) => {
              return {
                text: item.text,
                callback_data: JSON.stringify({
                  'command': item.command ?? "dummy_button"
                })
              }
            }))
          }
        }
      );


      bot.editMessageText(
        caption.replace(
          "Balance: loading...",
          `Balance: ${solbalance.toFixed(6)} SOL\n` +
          `💳 Token: ${splbalance} ${symbol ?? "\n"}`
        ),
        {
          message_id: sentMessage.message_id,
          chat_id,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [gaskeyboards, ...inline_keyboards].map((rowItem) => rowItem.map((item) => {
              return {
                text: item.text,
                callback_data: JSON.stringify({
                  'command': item.command ?? "dummy_button"
                })
              }
            }))
          }
        }
      );

      await MsgLogService.create({
        username,
        mint,
        wallet_address: user.wallet_address,
        chat_id,
        msg_id: sentMessage.message_id,
        sol_amount: solbalance,
        spl_amount: splbalance,
        extra_key: switchBtn
      });
    }
    const autoBuyAmount = parseFloat(user.auto_buy_amount);
    console.log("🚀 ~ contractInfoScreenHandler ~ autoBuyAmount:", autoBuyAmount)
    if (user.auto_buy) {
      console.log("🚀 ~ contractInfoScreenHandler ~ user.auto_buy:", user.auto_buy)
      await autoBuyHandler(
        bot,
        msg,
        user,
        mint,
        autoBuyAmount,
        solbalance,
        gasvalue,
        tokeninfo,
        slippage
      )
    }
  } catch (e) {
    console.log("~ contractInfoScreenHandler ~", e);
  }
}

export const changeBuySellHandler = async (bot: TelegramBot, msg: TelegramBot.Message, command: String) => {
  console.log("🚀 ~ changeBuySellHandler ~ command:", command)
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
}

export const changeGasFeeHandler = async (bot: TelegramBot, msg: TelegramBot.Message, gasfee: GasFeeEnum) => {
  const chat_id = msg.chat.id;
  const caption = msg.text;
  const username = msg.chat.username;
  const reply_markup = msg.reply_markup
  if (!caption || !username || !reply_markup) return;

  await UserTradeSettingService.setGas(
    username,
    {
      gas: gasfee
    }
  );

  const gaskeyboards = await UserTradeSettingService.getGasInlineKeyboard(gasfee);
  let inline_keyboard = reply_markup.inline_keyboard;
  inline_keyboard[0] = gaskeyboards.map((item) => {
    return {
      text: item.text,
      callback_data: JSON.stringify({
        'command': item.command
      })
    }
  })

  const gasvalue = UserTradeSettingService.getGasValue({ gas: gasfee });
  inline_keyboard[1][0] = {
    text: `${gasfee === GasFeeEnum.CUSTOM ? "🟢" : ""} Gas: ${gasvalue} SOL ⚙️`,
    callback_data: JSON.stringify({
      'command': 'custom_fee'
    })
  }

  await bot.editMessageReplyMarkup({
    inline_keyboard
  }, {
    message_id: msg.message_id,
    chat_id
  })
}

export const refreshHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    const reply_markup = msg.reply_markup
    if (!username || !reply_markup) return;

    // user
    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id
    });
    if (!msglog) return;
    const { mint } = msglog;

    // check token metadata
    const tokeninfo = await TokenService.getMintInfo(mint);
    if (!tokeninfo) {
      await sendNoneExistTokenNotification(bot, msg);
      return;
    }

    const gassetting = await UserTradeSettingService.getGas(username);
    const gaskeyboards = await UserTradeSettingService.getGasInlineKeyboard(gassetting.gas);
    let inline_keyboard = reply_markup.inline_keyboard;
    inline_keyboard[0] = gaskeyboards.map((item) => {
      return {
        text: item.text,
        callback_data: JSON.stringify({
          'command': item.command
        })
      }
    })

    const gasvalue = UserTradeSettingService.getGasValue(gassetting);
    inline_keyboard[1][0] = {
      text: `${gassetting.gas === GasFeeEnum.CUSTOM ? "🟢" : ""} Gas: ${gasvalue} SOL ⚙️`,
      callback_data: JSON.stringify({
        'command': 'custom_fee'
      })
    }

    const { overview, secureinfo } = tokeninfo;
    const { symbol, name, price, mc, liquidity } = overview;
    const { isToken2022, ownerAddress, freezeAuthority, transferFeeEnable, transferFeeData, top10HolderPercent } = secureinfo;

    const solprice = await TokenService.getSOLPrice();
    const solbalance = await TokenService.getSOLBalance(user.wallet_address, true);
    const splbalance = await TokenService.getSPLBalance(mint, user.wallet_address, isToken2022, true);

    let priceImpact = ((1 - (liquidity) / (liquidity + splbalance)) * 100).toFixed(2);

    let caption = `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${copytoclipboard(mint)}</i>\n\n`;

    const position = await PositionService.findOne({ wallet_address: user.wallet_address, mint });
    if (position) {
      const { sol_amount } = position;
      if (sol_amount > 0) {
        let pnl = (price / solprice * splbalance * 100) / sol_amount;

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

    caption += `🌳 Mint Disabled: ${ownerAddress ? "🔴" : "🍏"}\n` +
      // `🌳 Freeze Disabled: ${freezeAuthority ? "🔴" : "🍏"}\n\n` +
      `👥 Top 10 holder: ${top10HolderPercent && (top10HolderPercent > 0.15 ? '🟥' : '🍏')}  [ ${top10HolderPercent && (top10HolderPercent * 100)?.toFixed(2)}% held ]\n` +
      `💲 Price: <b>$${formatPrice(price)}</b>\n` +
      `💸 Price Impact: [${priceImpact} % of price impact if sold]\n` +
      `📊 Market Cap: <b>$${formatKMB(mc)}</b>\n\n` +
      `💳 <b>Balance: ${solbalance.toFixed(6)} SOL\n` +
      `💳 Token: ${splbalance} ${symbol ?? ""}</b>\n` +
      `${contractLink(mint)} • ${birdeyeLink(mint)} • ${dextoolLink(mint)} • ${dexscreenerLink(mint)}`;

    await bot.editMessageText(caption, {
      message_id: msg.message_id,
      chat_id, parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup
    });
  } catch (e) {
    console.log("~ refresh handler ~", e)
  }
}
// FPymkKgpg1sLFbVao4JMk4ip8xb8C8uKqfMdARMobHaw
// DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
