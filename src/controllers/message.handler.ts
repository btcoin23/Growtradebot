import TelegramBot from "node-telegram-bot-api";
import { isValidWalletAddress } from "../utils";
import { ContractInfoScreenHandler } from "../screens/contract.info.screen";
import { BUY_XSOL_TEXT, SELL_XPRO_TEXT, SET_SLIPPAGE_TEXT } from "../bot.opts";
import { buyHandler, sellHandler, setSlippageHandler } from "../screens/trade.screen";

export const messageHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const messageText = msg.text;
    const { reply_to_message } = msg;

    if (!messageText) return;

    // wallet address
    if (isValidWalletAddress(messageText)) {
      await ContractInfoScreenHandler(bot, msg, messageText);
      return;
    }

    if (reply_to_message && reply_to_message.text) {
      const { text } = reply_to_message;
      // if number, input amount
      const regex = /^[0-9]+(\.[0-9]+)?$/;
      const isNumber = regex.test(messageText) === true;
      const reply_message_id = reply_to_message.message_id;
      if (isNumber) {
        const amount = Number(messageText);
        if (text === BUY_XSOL_TEXT.replace(/<[^>]*>/g, '')) {
          await buyHandler(bot, msg, amount, reply_message_id);
        } else if (text === SELL_XPRO_TEXT.replace(/<[^>]*>/g, '')) {
          await sellHandler(bot, msg, amount, reply_message_id);
        } else if (text === SET_SLIPPAGE_TEXT.replace(/<[^>]*>/g, '')) {
          await setSlippageHandler(bot, msg, amount, reply_message_id);
        }
      }
    }
  } catch (e) {
    console.log("~messageHandler~", e);
  }
}