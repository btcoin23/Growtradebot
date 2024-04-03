import TelegramBot from "node-telegram-bot-api";
import { changeGasFeeHandler, switchToBuyHandler, switchToSellHandler } from "../screens/contract.info.screen";
import { GasFeeEnum } from "../services/gas.fee.service";
import { buyCustomAmountScreenHandler, buyHandler, sellCustomAmountScreenHandler, sellHandler, setSlippageScreenHandler } from "../screens/trade.screen";

export const callbackQueryHandler = async (
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
) => {
  try {
    const { data: callbackData, message: callbackMessage } = callbackQuery;
    if (!callbackData || !callbackMessage) return;

    const data = JSON.parse(callbackData);
    const opts = {
      chat_id: callbackMessage.chat.id,
      message_id: callbackMessage.message_id,
    };
    if (data.command.includes('dismiss_message')) {
      bot.deleteMessage(opts.chat_id, opts.message_id);
      return;
    }

    if (data.command.includes('dummy_button')) {
      return;
    }


    if (data.command.includes('switch_buy')) {
      await switchToBuyHandler(
        bot,
        callbackMessage,
      )
      return;
    }
    if (data.command.includes('switch_sell')) {
      await switchToSellHandler(
        bot,
        callbackMessage,
      )
      return;
    }
    if (data.command === 'low_gas') {
      await changeGasFeeHandler(bot, callbackMessage, GasFeeEnum.LOW);
      return;
    }
    if (data.command === 'medium_gas') {
      await changeGasFeeHandler(bot, callbackMessage, GasFeeEnum.MEDIUM);
      return;
    }
    if (data.command === 'high_gas') {
      await changeGasFeeHandler(bot, callbackMessage, GasFeeEnum.HIGH);
      return;
    }
    const buyTokenStr = 'buytoken_';
    if (data.command.includes(buyTokenStr)) {
      const buyAmount = Number(data.command.slice(buyTokenStr.length));
      await buyHandler(bot, callbackMessage, buyAmount, callbackMessage.text);
      return;
    }
    const sellTokenStr = 'selltoken_';
    if (data.command.includes(sellTokenStr)) {
      const sellPercent = Number(data.command.slice(sellTokenStr.length));
      await sellHandler(bot, callbackMessage, sellPercent, callbackMessage.text);
      return;
    }
    if (data.command.includes("buy_custom")) {
      await buyCustomAmountScreenHandler(bot, callbackMessage);
      return;
    }
    if (data.command.includes("sell_custom")) {
      await sellCustomAmountScreenHandler(bot, callbackMessage);
      return;
    }
    if (data.command.includes("set_slippage")) {
      await setSlippageScreenHandler(bot, callbackMessage);
      return;
    }
  } catch (e) {
    console.log(e);
  }
}
