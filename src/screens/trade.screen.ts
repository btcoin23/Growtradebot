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
import { GasFeeService } from "../services/gas.fee.service";

export const buyCustomAmountScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
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
      BUY_XSOL_TEXT,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
        }
      }
    );

    await TradeService.storeCustomTradeInfo(
      mint,
      username,
      sentMessage.message_id
    );
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
    await TradeService.storeCustomTradeInfo(
      mint,
      username,
      sentMessage.message_id
    );
  } catch (e) {
    console.log("~sellCustomAmountScreenHandler~", e);
  }
}

export const setSlippageScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
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
      SET_SLIPPAGE_TEXT,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
        }
      }
    );

    await TradeService.storeCustomTradeInfo(
      mint,
      username,
      sentMessage.message_id
    );
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
}

export const buyHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  caption?: string,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const user = await UserService.findOne({ username });
  if (!user) return;

  // Get mint
  let mint: any;
  if (caption) {
    mint = getTokenMintFromCallback(caption);
  } else if (reply_message_id) {
    const info = await TradeService.getCustomTradeInfo(
      username,
      reply_message_id
    );
    if (!info) return;
    mint = info;
  }
  if (!mint) return;

  // Insufficient check
  const sol = await TokenService.getSOLBalance(user.wallet_address);
  // check if enough includes fee
  if (sol <= amount + 0.005) {
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

  const solprice = await TokenService.getSOLPrice();

  // send Notification
  const getcaption = async (status: string, suffix: string = "") => {
    if (!caption || caption === "") {
      const metadata = await TokenService.fetchMetadataInfo(new PublicKey(mint ?? ""));

      const { tokenName, tokenSymbol } = metadata;

      const securecaption = `🌳 Token: ` + (tokenName ? `<b>${tokenName ?? ""} (${tokenSymbol ?? ""})</b>\n` : "\n") +
        `<i>${mint}</i>\n`;

      return `${securecaption}` + status + `💲 <b>Value: ${amount} SOL ($ ${(amount * solprice).toFixed(3)})</b>\n` + suffix;
    }

    return `${caption.split('\n')[0]}\n${caption.split('\n')[1]}\n` + status +
      `💲 <b>Value: ${amount} SOL ($ ${(amount * solprice).toFixed(3)})</b>\n` + suffix;
  }
  const buycaption = await getcaption(`🕒 <b>Buy in progress</b>\n`);

  bot.sendMessage(
    chat_id,
    buycaption,
    closeReplyMarkup
  )

  const gas = await GasFeeService.getGasSetting(username);
  // buy token
  const quoteResult = await JupiterService.swapToken(
    user.private_key,
    NATIVE_MINT.toBase58(),
    mint,
    9, // SOL decimal
    amount,
    5,
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
  caption?: string,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const user = await UserService.findOne({ username });
  if (!user) return;

  let mint: any;
  if (caption) {
    mint = getTokenMintFromCallback(caption);
  } else if (!mint && reply_message_id) {
    const info = await TradeService.getCustomTradeInfo(
      username,
      reply_message_id
    );
    if (!info) return;
    mint = info;
  }
  if (!mint) return;

  const sol = await TokenService.getSOLBalance(user.wallet_address);

  // check if enough includes fee
  if (sol <= 0.005) {
    bot.sendMessage(
      chat_id,
      "<b>⚠️ Insufficient SOL balance!</b>",
      closeReplyMarkup
    ).then(sentMessage => {
      setTimeout(() => {
        bot.deleteMessage(chat_id, sentMessage.message_id);
      }, 10000);
    })
    return;
  }

  const splBalance = await TokenService.getSPLBalance(
    mint,
    user.wallet_address,
    true,
    true
  );
  const sellAmount = splBalance * percent / 100;
  const splPrice = await TokenService.getSPLPrice(mint);

  // send Notification
  const getcaption = async (status: string, suffix: string = "") => {
    if (!caption || caption === "") {

      const metadata = await TokenService.fetchMetadataInfo(new PublicKey(mint ?? ""));
      const { tokenName, tokenSymbol } = metadata;

      const securecaption = `🌳 Token: ` + (tokenName ? `<b>${tokenName ?? ""} (${tokenSymbol ?? ""})</b>\n` : "\n") +
        `<i>${mint}</i>\n`;
      return `${securecaption}` + status + `💲 <b>Value: ${sellAmount} SOL ($ ${(sellAmount * splPrice).toFixed(3)})</b>\n` + suffix;
    }
    return `${caption.split('\n')[0]}\n${caption.split('\n')[1]}\n` + status +
      `💲 <b>Value: ${sellAmount} Token ($ ${(sellAmount * splPrice).toFixed(3)})</b>\n` + suffix;
  }

  const buycaption = await getcaption(`🕒 <b>Sell in progress</b>\n`);
  bot.sendMessage(
    chat_id,
    buycaption,
    closeReplyMarkup
  )

  // buy token
  const gas = await GasFeeService.getGasSetting(username);
  const decimal = await TradeService.getMintDecimal(mint);
  if (!decimal) return;
  const quoteResult = true; // await JupiterService.swapToken(
  //   user.private_key,
  //   mint,
  //   NATIVE_MINT.toBase58(),
  //   decimal,
  //   sellAmount,
  //   5,
  //   gas
  // );
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
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;
  await GasFeeService.setSlippageSetting(
    username,
    percent,
  )
}

const getTokenMintFromCallback = (caption: string | undefined) => {
  if (caption === undefined || caption === "") return null;
  const data = caption.split("\n")[1];
  if (data === undefined) return null;
  return data as string;
}