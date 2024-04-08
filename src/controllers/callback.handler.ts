import TelegramBot from "node-telegram-bot-api";
import { contractInfoScreenHandler, changeGasFeeHandler, refreshHandler } from "../screens/contract.info.screen";
import { GasFeeEnum } from "../services/user.trade.setting.service";
import { buyCustomAmountScreenHandler, buyHandler, sellCustomAmountScreenHandler, sellHandler, setSlippageScreenHandler } from "../screens/trade.screen";
import { cancelWithdrawHandler, transferFundScreenHandler, withdrawButtonHandler, withdrawCustomAmountScreenHandler, withdrawHandler } from "../screens/transfer.funds";
import { WelcomeScreenHandler, welcomeGuideHandler } from "../screens/welcome.screen";
import { generateNewWalletHandler, revealWalletPrivatekyHandler, settingScreenHandler, switchWalletHandler } from "../screens/settings.screen";
import { buySellScreenHandler } from "../screens/buy.sell.screen";

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

    if (data.command.includes('cancel_withdraw')) {
      await cancelWithdrawHandler(bot, callbackMessage);
      return;
    }

    if (data.command.includes('dummy_button')) {
      return;
    }

    if (data.command.includes('buysell')) {
      const replaceId = callbackMessage.message_id;
      await buySellScreenHandler(bot, callbackMessage, replaceId);
      return;
    }

    if (data.command.includes('BS_')) {
      const mint = data.command.slice(3);
      await contractInfoScreenHandler(bot, callbackMessage, mint);
      return;
    }

    if (data.command.includes('transfer_funds')) {
      const replaceId = callbackMessage.message_id;
      await transferFundScreenHandler(bot, callbackMessage, replaceId);
      return;
    }

    if (data.command.includes('TF_')) {
      const mint = data.command.slice(3);
      await withdrawButtonHandler(bot, callbackMessage, mint);
      return;
    }

    if (data.command.includes('withdrawtoken_custom')) {
      await withdrawCustomAmountScreenHandler(bot, callbackMessage);
      return;
    }

    const withdrawstr = 'withdraw_';
    if (data.command.includes(withdrawstr)) {
      const percent = data.command.slice(withdrawstr.length);
      await withdrawHandler(bot, callbackMessage, percent);
      return;
    }

    if (data.command.includes('settings')) {
      const replaceId = callbackMessage.message_id;
      await settingScreenHandler(bot, callbackMessage, replaceId)
    }

    if (data.command.includes('generate_wallet')) {
      await generateNewWalletHandler(bot, callbackMessage)
    }

    const pkstr = 'revealpk_';
    if (data.command.includes(pkstr)) {
      const nonce = Number(data.command.slice(pkstr.length));
      await revealWalletPrivatekyHandler(bot, callbackMessage, nonce);
    }

    const usewalletstr = 'usewallet_';
    if (data.command.includes(usewalletstr)) {
      const nonce = Number(data.command.slice(usewalletstr.length));
      await switchWalletHandler(bot, callbackMessage, nonce);
    }

    if (data.command.includes('back_home')) {
      const replaceId = callbackMessage.message_id;
      await welcomeGuideHandler(bot, callbackMessage, replaceId)
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
      await buyHandler(bot, callbackMessage, buyAmount);
      return;
    }
    const sellTokenStr = 'selltoken_';
    if (data.command.includes(sellTokenStr)) {
      const sellPercent = Number(data.command.slice(sellTokenStr.length));
      await sellHandler(bot, callbackMessage, sellPercent);
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

    if (data.command === 'refresh') {
      await refreshHandler(bot, callbackMessage);
      return;
    }
  } catch (e) {
    console.log(e);
  }
}
