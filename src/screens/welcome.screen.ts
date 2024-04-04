import TelegramBot from "node-telegram-bot-api"
import { UserService } from "../services/user.service"
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { GrowTradeVersion } from "../config";
import { copytoclipboard } from "../utils";
import { TokenService } from "../services/token.metadata";

const MAX_RETRIES = 5;
const welcomeKeyboardList = [
  // snipe_token, my_position
  [{ text: '🎯 Sniper [soon]', command: 'dummy_button' }, { text: '📊 Position [soon]', command: 'dummy_button' }],
  // [{ text: '🫳 Buy', command: 'buy_token' }, { text: '🫴 Sell', command: 'sell_token' }],
  [{ text: '♻️ Transfer funds', command: 'transfer_funds' }, { text: '⚙️ Setting', command: 'settings' }],
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

export const welcomeGuideHandler = async (bot: TelegramBot, msg: TelegramBot.Message, replaceId?: number) => {
  const { id: chat_id, username } = msg.chat;
  const user = await UserService.findOne({ username });

  if (!user) return;
  const solbalance = await TokenService.getSOLBalance(user.wallet_address);
  const caption = `<b>Welcome to GrowTrade | Beta Version</b>\n\n` +
    `The Unique Solana Trading Bot. Snipe, trade and keep track of your posisionts with GrowTrade.\n\n` +
    `⬩ A never seen unique Burn Mechanism 🔥\n` +
    `⬩ Revenue Share through Buy Backs on GrowSol ($GRW)\n\n` +
    `<b>💳 My Wallet:</b>${copytoclipboard(user.wallet_address)}\n` +
    `<b>💳 Balance:</b> ${solbalance} SOL\n\n` +
    `<a href="https://solscan.io/address/${user.wallet_address}">View on Explorer</a>\n\n` +
    `<b>Part of <a href="https://growsol.io">GrowSol</a>'s Ecosystem</b>\n\n` +
    `-----------------------\n` +
    `<a href="https://docs.growsol.io/docs">📖 Docs</a>\n` +
    `<a href="https://growsol.io">🌍 Website</a>\n\n` +
    `<b>Paste a contract address to trigger the Buy/Sell Menu or pick an option to get started.</b>`;

  const reply_markup = {
    inline_keyboard: welcomeKeyboardList.map((rowItem) => rowItem.map((item) => {
      return {
        text: item.text,
        callback_data: JSON.stringify({
          'command': item.command
        })
      }
    }))
  };

  if (replaceId) {
    bot.editMessageText(
      caption,
      {
        message_id: replaceId,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      }
    )
  } else {
    await bot.sendMessage(
      chat_id,
      caption,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      }
    );
  }
}
// export const WelcomeScreenHandler = () => {
//   try {

//   } catch {

//   }
// }