import TelegramBot from "node-telegram-bot-api";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { closeReplyMarkup, deleteDelayMessage, sendUsernameRequiredNotification } from "./common.screen";
import { UserService } from "../services/user.service";
import { copytoclipboard } from "../utils";
import { GrowTradeVersion, MAX_WALLET } from "../config";

export const settingScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  replaceId: number
) => {
  try {
    const { chat, } = msg;
    const { id: chat_id, username } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const users = await UserService.findAndSort({ username });
    const activeuser = users.filter(user => user.retired === false)[0];
    const { wallet_address } = activeuser;

    const caption = `GrowTrade ${GrowTradeVersion}\n\n<b>Your active wallet:</b>\n` +
      `${copytoclipboard(wallet_address)}`;

    const reply_markup = {
      inline_keyboard: [
        ...users.map((user) => {
          const { nonce, wallet_address, retired } = user;
          return [{
            text: `${retired ? "🔴" : "🟢"} ${wallet_address}`, callback_data: JSON.stringify({
              'command': `wallet_${nonce}`
            })
          },
          {
            text: `${retired ? "📌 Use this" : "🪄 In use"}`, callback_data: JSON.stringify({
              'command': `usewallet_${nonce}`
            })
          },
          {
            text: `🗝 Private key`, callback_data: JSON.stringify({
              'command': `revealpk_${nonce}`
            })
          }]
        }),
        [{
          text: '💳 Generate new wallet', callback_data: JSON.stringify({
            'command': 'generate_wallet'
          })
        }],
        [{
          text: '↩️ Back', callback_data: JSON.stringify({
            'command': 'back_home'
          })
        },
        {
          text: '❌ Close', callback_data: JSON.stringify({
            'command': 'dismiss_message'
          })
        }]
      ]
    }

    bot.editMessageText(
      caption,
      {
        message_id: replaceId,
        chat_id,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup
      }
    );
  } catch (e) { }
}

export const generateNewWalletHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const { chat, } = msg;
    const { id: chat_id, username, first_name, last_name } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const users = await UserService.find({ username });

    if (users.length >= MAX_WALLET) {
      const limitcaption = `<b>You have generated too many wallets. Max limit: ${MAX_WALLET}.</b>\n` +
        `<i>If you need any help, please contact support team.</i>`
      const sentmsg = await bot.sendMessage(
        chat_id,
        limitcaption,
        {
          parse_mode: 'HTML'
        }
      )
      deleteDelayMessage(bot, chat_id, sentmsg.message_id, 10000);
      return;
    }

    // find unique private_key
    let retries = 0;
    let userdata: any = null;
    let private_key = "";
    let wallet_address = "";
    do {
      const keypair = Keypair.generate();
      private_key = bs58.encode(keypair.secretKey);
      wallet_address = keypair.publicKey.toBase58();

      const wallet = await UserService.findOne({ wallet_address });
      if (!wallet) {
        // add
        const nonce = users.length;
        const newUser = {
          chat_id,
          username,
          first_name,
          last_name,
          wallet_address,
          private_key,
          nonce,
          retired: true
        };
        userdata = await UserService.create(newUser); // true; // 
      } else {
        retries++;
      }
    } while (retries < 5 && !userdata);

    // impossible to create
    if (!userdata) {
      await bot.sendMessage(
        chat_id,
        'Sorry, we cannot create your account. Please contact support team'
      )
      return;
    }
    // send private key & wallet address
    const caption = `👍 Congrates! 👋\n\n` +
      `A new wallet has been generated for you. This is your wallet address\n\n` +
      `${wallet_address}\n\n` +
      `<b>Save this private key below</b>❗\n\n` +
      `<tg-spoiler>${private_key}</tg-spoiler>\n\n`;

    await bot.sendMessage(
      chat_id,
      caption,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{
              text: '❌ Dismiss message',
              callback_data: JSON.stringify({
                'command': 'dismiss_message'
              })
            }]
          ]
        }
      }
    );
    settingScreenHandler(bot, msg, msg.message_id);
  } catch (e) {
    console.log("~generateNewWalletHandler~", e);
  }
}

export const revealWalletPrivatekyHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  nonce: number
) => {
  try {
    const { chat, } = msg;
    const { id: chat_id, username, first_name, last_name } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const user = await UserService.findOne({ username, nonce });
    if (!user) return;
    // send private key & wallet address
    const caption = `🗝 <b>Your private key</b>\n` +
      `<tg-spoiler>${user.private_key}</tg-spoiler>\n\n`;

    await bot.sendMessage(
      chat_id,
      caption,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{
              text: '❌ Dismiss message',
              callback_data: JSON.stringify({
                'command': 'dismiss_message'
              })
            }]
          ]
        }
      }
    );
    settingScreenHandler(bot, msg, msg.message_id);
  } catch (e) {
    console.log("~generateNewWalletHandler~", e);
  }
}

export const switchWalletHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  nonce: number
) => {
  try {
    const { chat, } = msg;
    const { username } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    await UserService.findAndUpdateOne({ username, retired: false }, { retired: true });
    await UserService.findAndUpdateOne({ username, nonce }, { retired: false });

    const sentmsg = await bot.sendMessage(
      chat.id,
      'Successfully updated',
    )
    deleteDelayMessage(bot, chat.id, sentmsg.message_id, 5000);
    settingScreenHandler(bot, msg, msg.message_id);
  } catch (e) {
    console.log("~generateNewWalletHandler~", e);
  }
}