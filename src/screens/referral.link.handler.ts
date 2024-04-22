import TelegramBot from "node-telegram-bot-api";
import { showWelcomeReferralProgramMessage } from "./welcome.referral.screen";
import { generateReferralCode } from "../utils";
import { UserService } from "../services/user.service";

export const OpenReferralWindowHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chat = msg.chat;
  const username = chat.username;
  if (!username) {
    return;
  }
  // const data = await get_referral_info(username);
  // // if not created
  // if (!data) {
  //   showWelcomeReferralProgramMessage(bot, chat);
  //   return;
  // }
  // // if already created a link, we show link
  // const { uniquecode } = data;
  let uniquecode = generateReferralCode(10);
  let userInfo = await UserService.findOne({ username: username });
  let referrerCode = "";
  if (userInfo?.referrer_code) {
    referrerCode = userInfo?.referrer_code;
  }
  else {
    await UserService.findAndUpdateOne({ username: username }, { referrer_code: uniquecode })
    referrerCode = uniquecode;
  }

  showWelcomeReferralProgramMessage(bot, chat, referrerCode);
}