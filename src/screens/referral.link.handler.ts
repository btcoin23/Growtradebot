import TelegramBot from "node-telegram-bot-api";
import { showWelcomeReferralProgramMessage } from "./welcome.referral.screen";
import { generateReferralCode } from "../utils";
import { UserService } from "../services/user.service";
import { ReferralChannelService } from "../services/referral.channel.service";

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
  const userInfo = await UserService.findOne({ username: username });
  if (!userInfo) return;
  const { referrer_code } = userInfo;

  let referrerCode = "";
  if (referrer_code && referrer_code !== "") {
    referrerCode = referrer_code;
  }
  else {
    let uniquecode = generateReferralCode(10);
    referrerCode = uniquecode;
    const referralChannelService = new ReferralChannelService();
    const res = await referralChannelService.createReferralChannel(
      username,
      uniquecode
    );
    console.log(res)
    if (!res) return;
    await UserService.updateMany({ username: username }, { referrer_code: uniquecode })
  }

  showWelcomeReferralProgramMessage(bot, chat, referrerCode);
}