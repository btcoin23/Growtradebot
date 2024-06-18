import TelegramBot from "node-telegram-bot-api";
import { contractInfoScreenHandler, changeGasFeeHandler, refreshHandler } from "../screens/contract.info.screen";
import { GasFeeEnum } from "../services/user.trade.setting.service";
import { buyCustomAmountScreenHandler, buyHandler, sellCustomAmountScreenHandler, sellHandler, setSlippageScreenHandler } from "../screens/trade.screen";
import { cancelWithdrawHandler, transferFundScreenHandler, withdrawButtonHandler, withdrawCustomAmountScreenHandler, withdrawHandler } from "../screens/transfer.funds";
import { WelcomeScreenHandler, welcomeGuideHandler } from "../screens/welcome.screen";
import { autoBuyAmountScreenHandler, changeJitoTipFeeHandler, generateNewWalletHandler, pnlCardHandler, presetBuyAmountScreenHandler, presetBuyBtnHandler, revealWalletPrivatekyHandler, setCustomAutoBuyAmountHandler, setCustomFeeScreenHandler, setCustomJitoFeeScreenHandler, settingScreenHandler, switchAutoBuyOptsHandler, switchBurnOptsHandler, switchWalletHandler, walletViewHandler } from "../screens/settings.screen";
import { positionScreenHandler } from "../screens/position.screen";
import { OpenReferralWindowHandler } from "../screens/referral.link.handler";
import { openAlertBotDashboard, sendMsgForAlertScheduleHandler, updateSchedule } from "../screens/bot.dashboard"
import { backToReferralHomeScreenHandler, refreshPayoutHandler, sendPayoutAddressManageScreen, setSOLPayoutAddressHandler } from "../screens/payout.screen";

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

    if (data.command.includes('position')) {
      // const replaceId = callbackMessage.message_id;
      await positionScreenHandler(bot, callbackMessage);
      return;
    }

    if (data.command.includes('burn_switch')) {
      await switchBurnOptsHandler(bot, callbackMessage);
      return;
    }

    if (data.command.includes('autobuy_switch')) {
      await switchAutoBuyOptsHandler(bot, callbackMessage);
      return;
    }

    if (data.command.includes('autobuy_amount')) {
      const replaceId = callbackMessage.message_id;
      await autoBuyAmountScreenHandler(bot, callbackMessage, replaceId);
      return;
    }

    if (data.command === 'pos_ref') {
      const replaceId = callbackMessage.message_id;
      await positionScreenHandler(bot, callbackMessage, replaceId);
      return;
    }

    // click on mint symbol from position
    if (data.command.includes('SPS_')) {
      const mint = data.command.slice(4);
      await contractInfoScreenHandler(bot, callbackMessage, mint, "switch_buy", true);
      return;
    }

    if (data.command.includes('BS_')) {
      const mint = data.command.slice(3);
      await contractInfoScreenHandler(bot, callbackMessage, mint, "switch_buy");
      return;
    }

    if (data.command.includes('SS_')) {
      const mint = data.command.slice(3);
      await contractInfoScreenHandler(bot, callbackMessage, mint, "switch_sell");
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
      console.log("Settings");
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

    if (data.command === 'custom_fee') {
      await setCustomFeeScreenHandler(bot, callbackMessage);
      return;
    }

    if (data.command === 'switch_mev') {
      await changeJitoTipFeeHandler(bot, callbackMessage);
      return;
    }

    if (data.command === 'custom_jitofee') {
      await setCustomJitoFeeScreenHandler(bot, callbackMessage);
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
    if (data.command.includes("preset_setting")) {
      await presetBuyBtnHandler(bot, callbackMessage);
      return;
    }
    if (data.command.includes("wallet_view")) {
      await walletViewHandler(bot, callbackMessage);
      return;
    }
    if (data.command === 'referral') {
      await OpenReferralWindowHandler(bot, callbackMessage)
    }
    // Open payout dashboard
    if (data.command === 'payout_address') {
      await sendPayoutAddressManageScreen(
        bot,
        callbackMessage.chat,
        callbackMessage.message_id
      );
    }
    // Update SOL address
    if (data.command === 'set_sol_address') {
      await setSOLPayoutAddressHandler(
        bot,
        callbackMessage.chat,
      );
    }
    else if (data.command === 'refresh_payout') {
      await refreshPayoutHandler(
        bot,
        callbackMessage,
      );
    }
    // Alert Bot
    if (data.command === 'alert_bot' || data.command === 'refresh_alert_bot') {
      bot.deleteMessage(callbackMessage.chat.id, callbackMessage.message_id);
      await openAlertBotDashboard(
        bot,
        callbackMessage.chat,
      );
    }
    // Schedule
    else if (data.command.includes('alert_schedule')) {
      await sendMsgForAlertScheduleHandler(
        bot,
        callbackMessage.chat,
      );
    }
    // Back home
    else if (data.command === 'back_from_ref') {
      await backToReferralHomeScreenHandler(
        bot,
        callbackMessage.chat,
        callbackMessage
      );
    }
    else if (data.command.includes('schedule_time_')) {
      const scheduleTime = data.command.slice(14)

      await updateSchedule(
        bot,
        callbackMessage.chat,
        scheduleTime,
      );
    }
    const presetBuyStr = 'preset_buy_';
    if (data.command.includes(presetBuyStr)) {
      const preset_index = parseInt(data.command.slice(presetBuyStr.length));
      await presetBuyAmountScreenHandler(bot, callbackMessage, preset_index);
      return;
    }
    if (data.command === 'refresh') {
      await refreshHandler(bot, callbackMessage);
      return;
    }

    if(data.command === 'pnl_card'){
      await pnlCardHandler(bot, callbackMessage);
      return;
    }
  } catch (e) {
    console.log(e);
  }
}
