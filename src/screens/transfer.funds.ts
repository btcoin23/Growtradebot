import TelegramBot, { InlineKeyboardButton, InlineKeyboardMarkup } from "node-telegram-bot-api";
import { closeReplyMarkup, sendInsufficientNotification, sendNoneExistTokenNotification, sendUsernameRequiredNotification } from "./common.screen";
import { UserService } from "../services/user.service";
import { copytoclipboard, isValidWalletAddress } from "../utils";
import { TokenService } from "../services/token.metadata";
import { GrowTradeVersion } from "../config";
import { WITHDRAW_TOKEN_AMT_TEXT, WITHDRAW_XTOKEN_TEXT } from "../bot.opts";
import { MsgLogService } from "../services/msglog.service";
import { JupiterService } from "../services/jupiter.service";
import { NATIVE_MINT } from "@solana/spl-token";

export const transferFundScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message, replaceId: number) => {
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
      `<b>Balance: loading...</b>\n`;

    const reply_markup = {
      inline_keyboard: [
        [{
          text: 'Loading...', callback_data: JSON.stringify({
            'command': 'dummy_button'
          })
        },
        {
          text: '↩️ Back', callback_data: JSON.stringify({
            'command': 'back_home'
          })
        }]
      ]
    }

    bot.editMessageText(
      temp,
      {
        message_id: replaceId,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      }
    );

    const sol = await TokenService.getSOLBalance(user.wallet_address, true);
    const tokenaccounts = await TokenService.getTokenAccounts(user.wallet_address);

    let caption = `GrowTrade ${GrowTradeVersion}\n💳 <b>Your wallet address</b>\n` +
      `<i>${copytoclipboard(user.wallet_address)}</i>\n\n` +
      `<b>Balance: ${sol} SOL</b>\n`;

    // Initialize the transferInlineKeyboards array with an empty array
    const transferInlineKeyboards: InlineKeyboardButton[][] = [
      [
        { text: '🌳 Withdraw SOL', callback_data: JSON.stringify({ 'command': `TF_${NATIVE_MINT.toBase58()}` }) },
        { text: '↩️ Back', callback_data: JSON.stringify({ 'command': 'back_home' }) }
      ]
    ];

    let idx = 3;
    tokenaccounts.forEach(item => {
      const { mint: mintAddress, amount: tokenBalance, symbol } = item;
      caption += `\n- <b>Token: ${tokenBalance} ${symbol}</b>\n<i>${copytoclipboard(mintAddress)}</i>\n`;

      // Check if the current nested array exists
      if (!transferInlineKeyboards[Math.floor(idx / 3)]) {
        transferInlineKeyboards.push([]);
      }

      // Push the new inline keyboard button to the appropriate nested array
      transferInlineKeyboards[Math.floor(idx / 3)].push({
        text: `Withdraw ${symbol ? symbol : mintAddress}`,
        callback_data: JSON.stringify({
          'command': `TF_${mintAddress}`
        })
      });

      idx++;
    });

    const new_reply_markup = {
      inline_keyboard: transferInlineKeyboards
    }
    bot.editMessageText(
      caption,
      {
        message_id: replaceId,
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

export const withdrawButtonHandler = async (
  bot: TelegramBot, msg: TelegramBot.Message, mint: string
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;


    const sentMessage = await bot.sendMessage(
      chat_id,
      WITHDRAW_TOKEN_AMT_TEXT,
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
    console.log("~ withdrawButtonHandler~", e);
  }
}

export const withdrawAddressHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  receive_address: string,
  reply_message_id: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;
  const user = await UserService.findOne({ username });
  if (!user) return;

  if (!isValidWalletAddress(receive_address)) {
    bot.sendMessage(
      chat_id,
      `<b>Invalid wallet address. Please try it again.</b>`,
      closeReplyMarkup
    );
    return;
  }

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id,
  });

  if (!msglog) return;

  const { mint } = msglog;
  const mintinfo = await TokenService.getMintInfo(mint);

  if (!mintinfo) return;
  const { name, symbol } = mintinfo.overview;
  const { isToken2022 } = mintinfo.secureinfo;

  const balance = (mint === NATIVE_MINT.toBase58()) ?
    await TokenService.getSOLBalance(user.wallet_address) :
    await TokenService.getSPLBalance(mint, user.wallet_address, isToken2022);

  const tokenName = (mint === NATIVE_MINT.toBase58()) ? "SOL" : name;
  const caption = `<b>Token: ${tokenName} (${symbol ?? "undefined"})</b>\n` +
    `<i>${copytoclipboard(mint)}</i>\n` +
    `Balance: ${balance}\n\n` +
    `<b>Receive wallet:</b> ${copytoclipboard(receive_address)}`;

  const sentMessage = await bot.sendMessage(
    chat_id,
    caption,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'Withraw 10%',
            callback_data: JSON.stringify({
              command: 'withdraw_10'
            })
          }, {
            text: 'Withraw 50%',
            callback_data: JSON.stringify({
              command: 'withdraw_50'
            })
          }, {
            text: 'Withraw 100%',
            callback_data: JSON.stringify({
              command: 'withdraw_100'
            })
          }],
          [{
            text: 'Withraw X',
            callback_data: JSON.stringify({
              command: 'withdrawtoken_custom'
            })
          }, {
            text: '❌ Cancel',
            callback_data: JSON.stringify({
              command: 'cancel_withdraw'
            })
          }]
        ]
      }
    }
  )

  await MsgLogService.create({
    chat_id,
    msg_id: sentMessage.message_id,
    username,
    mint,
    wallet_address: receive_address,
    spl_amount: mint === NATIVE_MINT.toBase58() ? 0 : balance,
    parent_msgid: reply_message_id,
    sol_amount: mint === NATIVE_MINT.toBase58() ? balance : 0,
    extra_id: msg.message_id
  })
}

export const withdrawHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  percentstr: string,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;
  const user = await UserService.findOne({ username });
  if (!user) return;

  const regex = /^[0-9]+(\.[0-9]+)?$/;
  const isNumber = regex.test(percentstr) === true;
  if (!isNumber) {
    bot.sendMessage(
      chat_id,
      `<b>Invalid number for amount. Please try it again.</b>`,
      closeReplyMarkup
    );
    return;
  }
  const percent = Number(percentstr);

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id ?? msg.message_id
  });

  if (!msglog) return;
  const { mint, wallet_address: topubkey } = msglog;

  if (!mint) return;

  const mintinfo = await TokenService.getMintInfo(mint);

  if (!mintinfo) return;
  const { name, symbol, price, decimals } = mintinfo.overview;

  const tokenName = (mint === NATIVE_MINT.toBase58()) ? "SOL" : name;

  const { isToken2022 } = mintinfo.secureinfo;
  const balance = (mint === NATIVE_MINT.toBase58()) ?
    (await TokenService.getSOLBalance(user.wallet_address) - 0.000025) :
    await TokenService.getSPLBalance(mint, user.wallet_address, isToken2022);

  const amount = reply_message_id ? percent : balance * percent / 100;
  if (amount > balance) {
    await sendInsufficientNotification(bot, msg);
    return;
  }
  // send Notification
  const getcaption = async (status: string, suffix: string = "") => {

    const securecaption = `🌳 Token: <b>${tokenName ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${copytoclipboard(mint)}</i>\n` + status +
      `💲 <b>Value: ${amount} ${symbol} ($ ${(amount * price).toFixed(3)})</b>\n` + suffix;
    return securecaption;
  }

  const buycaption = await getcaption(`🕒 <b>Withdraw in progress</b>\n`);
  const pendingMessage = await bot.sendMessage(
    chat_id,
    buycaption,
    {
      parse_mode: 'HTML',
    }
  )

  const transferResult = (mint === NATIVE_MINT.toBase58()) ?
    await JupiterService.transferSOL(amount, 9, topubkey, user.private_key, 100000, 200000) :
    await JupiterService.transferSPL(mint, amount, decimals, topubkey, user.private_key, isToken2022);
  if (transferResult) {
    const txn = transferResult;
    const suffix = `📈 Txn: <a href="https://solscan.io/tx/${txn}">${txn}</a>\n`;
    const successCaption = await getcaption(`🟢 <b>Withdraw Success</b>\n`, suffix);

    bot.editMessageText(
      successCaption,
      {
        message_id: pendingMessage.message_id,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
      }
    )
  } else {
    const failedCaption = await getcaption(`🔴 <b>Withdraw Failed</b>\n`);
    bot.editMessageText(
      failedCaption,
      {
        message_id: pendingMessage.message_id,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
      }
    )
  }
}

export const withdrawCustomAmountScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
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
      WITHDRAW_XTOKEN_TEXT,
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
    console.log("~withdrawCustomAmountScreenHandler~", e);
  }
}

export const cancelWithdrawHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chat_id = msg.chat.id;
  const message_id = msg.message_id;
  const username = msg.chat.username;

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: message_id,
  });

  if (!msglog) return;

  const { parent_msgid, extra_id } = msglog;
  bot.deleteMessage(chat_id, message_id);
  if (extra_id) {
    bot.deleteMessage(chat_id, extra_id);
  }
  bot.deleteMessage(chat_id, parent_msgid);
}