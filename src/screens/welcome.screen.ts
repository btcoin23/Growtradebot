import TelegramBot from "node-telegram-bot-api"
import { UserService } from "../services/user.service"
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const MAX_RETRIES = 5;
const welcomeKeyboardList = [
  // snipe_token, my_position
  [{ text: '🎯 Sniper [soon]', command: 'dummy_button' }, { text: '📊 Position [soon]', command: 'dummy_button' }],
  // [{ text: '🫳 Buy', command: 'buy_token' }, { text: '🫴 Sell', command: 'sell_token' }],
  [{ text: '🚀 Transfer funds', command: 'transfer_token' }, { text: '🔧 Setting', command: 'setting' }],
  [{ text: '❌ Close', command: 'dismiss_message' }],
];

export const WelcomeScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  try {
    const { username, id: chat_id, first_name, last_name } = msg.chat;
    // check if bot
    if (!username) {
      bot.sendMessage(
        chat_id,
        '⚠️ You have no telegram username. Please take at least one and try it again.'
      )
      return;
    }
    const user = await UserService.findOne({ username });
    // if new user, create one
    if (!user) {
      const res = await newUserHandler(bot, msg);
      console.log("1welcome message", res);

      if (!res) return;
    }
    console.log("welcome message");
    // send welcome guide
    await welcomeGuideHandler(bot, msg);
    await bot.deleteMessage(chat_id, msg.message_id);
  } catch (error) {
    console.log(error);
  }
}

const newUserHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const { username, id: chat_id, first_name, last_name } = msg.chat;

  let retries = 0;
  let userdata: any = null;
  let private_key = "";
  let wallet_address = "";

  // find unique private_key
  do {
    const keypair = Keypair.generate();
    private_key = bs58.encode(keypair.secretKey);
    wallet_address = keypair.publicKey.toBase58();

    const wallet = await UserService.findOne({ wallet_address });
    if (!wallet) {
      // add
      const newUser = {
        chat_id,
        username,
        first_name,
        last_name,
        wallet_address,
        private_key,
      };
      userdata = await UserService.create(newUser); // true; // 
    } else {
      retries++;
    }
  } while (retries < MAX_RETRIES && !userdata);

  // impossible to create
  if (!userdata) {
    await bot.sendMessage(
      chat_id,
      'Sorry, we cannot create your account. Please contact support team'
    )
    return false;
  }

  // send private key & wallet address
  const caption = `👋 Welcome to GrowTradeBot!\n\n` +
    `A new wallet has been generated for you. This is your wallet address\n\n` +
    `${wallet_address}\n\n` +
    `<b>Save this private key below</b>❗\n\n` +
    `<tg-spoiler>${private_key}</tg-spoiler>\n\n` +
    `<b>To get started, please read our <a href="https://docs.growsol.io">docs</a></b>`;

  await bot.sendMessage(
    chat_id,
    caption,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{
            text: '* Dismiss message',
            callback_data: JSON.stringify({
              'command': 'dismiss_message'
            })
          }]
        ]
      }
    }
  );
  return true;
}

const welcomeGuideHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const { id: chat_id } = msg.chat;

  const caption = `GrowTrade 0.1\n` +
    `Your favorite trading bot\n\n` +
    `-----------------------------\n` +
    `<a href="https://docs.growsol.io/docs">📖 Docs</a>\n` +
    `<a href="https://t.me/GrowSolEcosystemAlerts">💬 Official Chat</a>\n` +
    `<a href="https://growsol.io">🌍 Website</a>\n\n` +
    `<b>Paste a contract address or pick an option to get started.</b>`;
  await bot.sendMessage(
    chat_id,
    caption,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: welcomeKeyboardList.map((rowItem) => rowItem.map((item) => {
          return {
            text: item.text,
            callback_data: JSON.stringify({
              'command': item.command
            })
          }
        }))
      }
    }
  )
}
// export const WelcomeScreenHandler = () => {
//   try {

//   } catch {

//   }
// }