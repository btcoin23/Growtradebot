import TelegramBot from "node-telegram-bot-api"
import { TokenService } from "../services/token.metadata";
import { PublicKey } from "@solana/web3.js";
import { birdeyeLink, contractLink, dexscreenerLink, dextoolLink, formatNumber, formatPrice, getPrice } from "../utils";
import { connection } from "../config";
import { UserService } from "../services/user.service";
import { sendNoneExistTokenNotification, sendNoneUserNotification, sendUsernameRequiredNotification } from "./common.screen";
import { GasFeeEnum, GasFeeService } from "../services/gas.fee.service";
import { TradeService } from "../services/trade.service";

const inline_keyboards = [
  [{ text: "Gas: 0.000105 SOL", command: null }],
  [{ text: "-----------------------------------", command: null }],
  [{ text: "Slippage: 5%", command: 'set_slippage' }],
  [{ text: "Buy 1 SOL", command: 'buytoken_1' }, { text: "Buy 0.5 SOL", command: 'buytoken_5' }, { text: "Buy X SOL", command: 'buy_custom' }],
  [{ text: "-------------SELL-----------------", command: null }],
  [{ text: "Sell 50%", command: 'selltoken_50' }, { text: "Sell 100%", command: 'selltoken_100' }, { text: "Sell X %", command: 'sell_custom' }],
  [{ text: "🔄 Refresh", command: 'refresh' }, { text: "❌ Close", command: 'close' }],
]


export const ContractInfoScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message, mint: string) => {
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
    console.log("ContractInfoScreenHandler", mint);

    // check token metadata
    console.log("start", Date.now())
    const tokeninfo = await TokenService.getMintInfo(mint);
    console.log("end", Date.now())

    if (!tokeninfo || tokeninfo === "NONE") {
      await sendNoneExistTokenNotification(bot, msg);
      return;
    }
    const { overview, secureinfo } = tokeninfo;
    const { symbol, name, price, mc } = overview;
    const { isToken2022, ownerAddress, freezeAuthority, transferFeeEnable, transferFeeData } = secureinfo;
    const solbalance = await TokenService.getSOLBalance(user.wallet_address);

    const caption = `🌳 Token: ` +
      (name ? `<b>${name ?? ""} (${symbol ?? ""})</b>\n` : "\n") +
      `<i>${mint}</i>\n\n` +
      `🌳 Mint Disabled: ${ownerAddress ? "🔴" : "🍏"}\n` +
      `🌳 Freeze Disabled: ${freezeAuthority ? "🔴" : "🍏"}\n\n` +
      `💲 Price: <b>$${formatPrice(price)}</b>\n` +
      `📊 Market Cap: <b>$${formatNumber(mc)}</b>\n\n` +
      `💳 <b>Balance: ${solbalance.toFixed(6)} SOL</b>\n` +
      `${contractLink(mint)} • ${birdeyeLink(mint)} • ${dextoolLink(mint)} • ${dexscreenerLink(mint)}`;

    const gasfee = await GasFeeService.getGasSetting(username);
    const gaskeyboards = await GasFeeService.getGasInlineKeyboard(username, gasfee);
    const gasvalue = await GasFeeService.getGasValue(username, gasfee);
    inline_buy_keyboards[0][0].text = gasvalue;
    const slippage = await GasFeeService.getSlippageSetting(username);
    inline_buy_keyboards[2][0].text = `Slippage: ${slippage} %`;

    const sendMessage = await bot.sendMessage(
      chat_id,
      caption,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [gaskeyboards, ...inline_buy_keyboards].map((rowItem) => rowItem.map((item) => {
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

    await bot.deleteMessage(chat_id, msg.message_id);
  } catch (e) {
    console.log("~ ContractInfoScreenHandler ~", e);
  }
}

export const switchToBuyHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chat_id = msg.chat.id;
  const caption = msg.text;
  const username = msg.chat.username;
  if (!caption || !username) return;

  const gasfee = await GasFeeService.getGasSetting(username);
  const gaskeyboards = await GasFeeService.getGasInlineKeyboard(username, gasfee);
  const gasvalue = await GasFeeService.getGasValue(username, gasfee);
  inline_buy_keyboards[0][0].text = gasvalue;
  const slippage = await GasFeeService.getSlippageSetting(username);
  inline_buy_keyboards[2][0].text = `Slippage: ${slippage} %`;

  await bot.editMessageText(caption, {
    message_id: msg.message_id,
    chat_id, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: {
      inline_keyboard: [gaskeyboards, ...inline_buy_keyboards].map((rowItem) => rowItem.map((item) => {
        return {
          text: item.text,
          callback_data: JSON.stringify({
            'command': item.command ?? "dummy_button"
          })
        }
      }))
    }
  });
}

export const switchToSellHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chat_id = msg.chat.id;
  const caption = msg.text;
  const username = msg.chat.username;
  const user = await UserService.findOne({ username });
  if (!user) return;
  if (!caption || !username) return;

  const gasfee = await GasFeeService.getGasSetting(username);
  const gaskeyboards = await GasFeeService.getGasInlineKeyboard(username, gasfee);
  const gasvalue = await GasFeeService.getGasValue(username, gasfee);
  inline_buy_keyboards[0][0].text = gasvalue;
  const slippage = await GasFeeService.getSlippageSetting(username);
  inline_buy_keyboards[2][0].text = `Slippage: ${slippage} %`;

  const mint = getTokenMintFromCallback(caption);
  // Profits
  const price = await getPrice(mint);
  const tokenBalnce = await TokenService.getSPLBalance(mint, user.wallet_address, true);
  // buy volume

  await bot.editMessageText(
    caption, {
    message_id: msg.message_id,
    chat_id, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: {
      inline_keyboard: [gaskeyboards, ...inline_sell_keyboards].map((rowItem) => rowItem.map((item) => {
        return {
          text: item.text,
          callback_data: JSON.stringify({
            'command': item.command ?? "dummy_button"
          })
        }
      }))
    }
  });
}

export const changeGasFeeHandler = async (bot: TelegramBot, msg: TelegramBot.Message, gasfee: GasFeeEnum) => {
  const chat_id = msg.chat.id;
  const caption = msg.text;
  const username = msg.chat.username;
  const reply_markup = msg.reply_markup
  if (!caption || !username || !reply_markup) return;

  await GasFeeService.setGasSetting(username, gasfee);
  const gaskeyboards = await GasFeeService.getGasInlineKeyboard(username);
  let inline_keyboard = reply_markup.inline_keyboard;
  inline_keyboard[0] = gaskeyboards.map((item) => {
    return {
      text: item.text,
      callback_data: JSON.stringify({
        'command': item.command
      })
    }
  })

  const gasvalue = await GasFeeService.getGasValue(username, gasfee);
  inline_keyboard[1][0].text = gasvalue;

  await bot.editMessageReplyMarkup({
    inline_keyboard
  }, {
    message_id: msg.message_id,
    chat_id
  })
}

const getTokenMintFromCallback = (caption: string) => {
  return caption.split("\n")[1];
}