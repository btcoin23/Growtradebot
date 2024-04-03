import TelegramBot from "node-telegram-bot-api";
import { JupiterService } from "../services/jupiter.service";
import { TokenService } from "../services/token.metadata";
import { closeReplyMarkup, deleteDelayMessage } from "./common.screen";
import { UserService } from "../services/user.service";
import { BUY_XSOL_TEXT, SELL_XPRO_TEXT, SET_SLIPPAGE_TEXT } from "../bot.opts";
import { TradeService } from "../services/trade.service";
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { amount } from "@metaplex-foundation/js";
import { UserTradeSettingService } from "../services/user.trade.setting.service";
import { MsgLogService } from "../services/msglog.service";
import { inline_keyboards } from "./contract.info.screen";

export const buyCustomAmountScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id
    });
    if (!msglog) return;
    const { mint } = msglog;
    if (!mint) return;

    const sentMessage = await bot.sendMessage(
      chat_id,
      BUY_XSOL_TEXT,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
        }
      }
    );

    await MsgLogService.create({
      username,
      mint,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id
    });
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
}

export const sellCustomAmountScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  try {
    const chat_id = msg.chat.id;
    const caption = msg.text;
    const username = msg.chat.username;
    const user = await UserService.findOne({ username });
    if (!user) return;
    if (!caption || !username) return;
    const mint = getTokenMintFromCallback(caption);
    if (!mint) return;

    const sentMessage = await bot.sendMessage(
      chat_id,
      SELL_XPRO_TEXT,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
        }
      }
    );

    await MsgLogService.create({
      username,
      mint,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id
    });
  } catch (e) {
    console.log("~sellCustomAmountScreenHandler~", e);
  }
}

export const setSlippageScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id
    });
    if (!msglog) return;
    const { mint } = msglog;

    if (!mint) return;

    const sentMessage = await bot.sendMessage(
      chat_id,
      SET_SLIPPAGE_TEXT,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
        }
      }
    );

    await MsgLogService.create({
      username,
      mint,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id
    });
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
}

export const buyHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const user = await UserService.findOne({ username });
  if (!user) return;

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id ?? msg.message_id
  });
  if (!msglog) return;
  const { mint, sol_amount } = msglog;
  // const solbalance = sol_amount ?? await TokenService.getSOLBalance(user.wallet_address);

  if (!mint) return;

  // Insufficient check check if enough includes fee
  if (sol_amount && sol_amount <= amount + 0.005) {
    bot.sendMessage(
      chat_id,
      "<b>⚠️ Insufficient SOL balance!</b>",
      closeReplyMarkup
    ).then(sentMessage => {
      setTimeout(() => {
        bot.deleteMessage(chat_id, sentMessage.message_id);
      }, 5000);
    })
    return;
  }

  const mintinfo = await TokenService.getMintInfo(mint);
  if (!mintinfo || mintinfo === "NONE") return;
  const { name, symbol, price } = mintinfo.overview;
  const { isToken2022 } = mintinfo.secureinfo;
  const solprice = await TokenService.getSOLPrice();
  // send Notification
  const getcaption = async (status: string, suffix: string = "") => {
    const securecaption = `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${mint}</i>\n` + status +
      `💲 <b>Value: ${amount} SOL ($ ${(amount * solprice).toFixed(3)})</b>\n` +
      `💴 Fee: 0.75%\n` + suffix;

    return securecaption;
  }
  const buycaption = await getcaption(`🕒 <b>Buy in progress</b>\n`);

  bot.sendMessage(
    chat_id,
    buycaption,
    closeReplyMarkup
  )

  const { gas, slippage } = await UserTradeSettingService.get(username, mint);
  // buy token
  const quoteResult = await JupiterService.swapToken(
    user.private_key,
    NATIVE_MINT.toBase58(),
    mint,
    9, // SOL decimal
    amount,
    slippage,
    gas
  );
  if (quoteResult) {
    const txn = quoteResult;
    const suffix = `📈 Txn: <a href="https://solscan.io/tx/${txn}">${txn}</a>\n`;
    const successCaption = await getcaption(`🟢 <b>Buy Success</b>\n`, suffix);
    bot.sendMessage(
      chat_id,
      successCaption,
      closeReplyMarkup
    )
  } else {

    const failedCaption = await getcaption(`🔴 <b>Buy Failed</b>\n`);
    bot.sendMessage(
      chat_id,
      failedCaption,
      closeReplyMarkup
    )
  }
}

export const sellHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  percent: number,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const user = await UserService.findOne({ username });
  if (!user) return;


  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id ?? msg.message_id
  });

  if (!msglog) return;
  const { mint, spl_amount, sol_amount } = msglog;
  console.log("==>", mint, sol_amount)

  if (!mint) return;
  // check if enough includes fee
  if (sol_amount && sol_amount <= 0.005) {
    bot.sendMessage(
      chat_id,
      "<b>⚠️ Insufficient SOL balance for gas fee!</b>",
      closeReplyMarkup
    ).then(sentMessage => {
      setTimeout(() => {
        bot.deleteMessage(chat_id, sentMessage.message_id);
      }, 10000);
    })
    return;
  }

  const mintinfo = await TokenService.getMintInfo(mint);

  if (!mintinfo || mintinfo === "NONE") return;
  const { name, symbol, price, decimals } = mintinfo.overview;
  const { isToken2022 } = mintinfo.secureinfo;

  const splbalance = (!spl_amount || spl_amount === 0) ? await TokenService.getSPLBalance(mint, user.wallet_address, isToken2022) : spl_amount;
  const sellAmount = splbalance * percent / 100;

  // send Notification
  const getcaption = async (status: string, suffix: string = "") => {

    const securecaption = `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${mint}</i>\n` + status +
      `💲 <b>Value: ${sellAmount} ${symbol} ($ ${(sellAmount * price).toFixed(3)})</b>\n` +
      `💴 Fee: 0.75%\n` + suffix;
    return securecaption;
  }

  const buycaption = await getcaption(`🕒 <b>Sell in progress</b>\n`);
  bot.sendMessage(
    chat_id,
    buycaption,
    closeReplyMarkup
  )

  // buy token
  const { gas, slippage } = await UserTradeSettingService.get(username, mint);

  const quoteResult = await JupiterService.swapToken(
    user.private_key,
    mint,
    NATIVE_MINT.toBase58(),
    decimals,
    sellAmount,
    slippage,
    gas
  );
  if (quoteResult) {
    const txn = quoteResult;
    const suffix = `📈 Txn: <a href="https://solscan.io/tx/${txn}">${txn}</a>\n`;
    const successCaption = await getcaption(`🟢 <b>Sell Success</b>\n`, suffix);
    bot.sendMessage(
      chat_id,
      successCaption,
      closeReplyMarkup
    )
  } else {
    const failedCaption = await getcaption(`🔴 <b>Sell Failed</b>\n`);
    bot.sendMessage(
      chat_id,
      failedCaption,
      closeReplyMarkup
    )
  }
}

export const setSlippageHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  percent: number,
  reply_message_id: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id
  });
  if (!msglog) return;
  const { mint, parent_msgid, msg_id } = msglog;

  if (!mint) return;

  const oldone = await UserTradeSettingService.get(username, mint);
  const newone = oldone;
  newone.slippage = percent;
  await UserTradeSettingService.set(
    username,
    mint,
    newone,
  );

  const { gas: gasfee, slippage } = newone;
  const gaskeyboards = await UserTradeSettingService.getGasInlineKeyboard(gasfee);
  const gasvalue = await UserTradeSettingService.getGasValue(gasfee);

  inline_keyboards[0][0].text = gasvalue;
  inline_keyboards[1][0].text = `Slippage: ${slippage} %`;

  await bot.editMessageReplyMarkup({
    inline_keyboard: [gaskeyboards, ...inline_keyboards].map((rowItem) => rowItem.map((item) => {
      return {
        text: item.text,
        callback_data: JSON.stringify({
          'command': item.command ?? "dummy_button"
        })
      }
    }))
  }, {
    message_id: parent_msgid,
    chat_id
  });
  bot.deleteMessage(chat_id, msg_id);
  bot.deleteMessage(chat_id, msg.message_id);
}

const getTokenMintFromCallback = (caption: string | undefined) => {
  if (caption === undefined || caption === "") return null;
  const data = caption.split("\n")[1];
  if (data === undefined) return null;
  return data as string;
}