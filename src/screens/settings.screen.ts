import TelegramBot from "node-telegram-bot-api";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { closeReplyMarkup, deleteDelayMessage, sendNoneUserNotification, sendUsernameRequiredNotification } from "./common.screen";
import { UserService } from "../services/user.service";
import { copytoclipboard } from "../utils";
import { GrowTradeVersion, MAX_WALLET } from "../config";
import { MsgLogService } from "../services/msglog.service";
import redisClient from "../services/redis";
import { PRESET_BUY_TEXT } from "../bot.opts";
import { wait } from "../utils/wait";

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
        [{
          text: `💳 Wallet`, callback_data: JSON.stringify({
            'command': `wallet_view`
          })
        }, {
          text: `🗒  Preset Settings`, callback_data: JSON.stringify({
            'command': `preset_setting`
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
  } catch (e) { console.log("~ settingScreenHandler ~", e) }
}

export const presetBuyBtnHandler = async (bot: TelegramBot,
  msg: TelegramBot.Message) => {
  const { chat, } = msg;
  const { id: chat_id, username, first_name, last_name } = chat;
  if (!username) {
    await sendUsernameRequiredNotification(bot, msg);
    return;
  }
  const user = await UserService.findOne({ username });
  if (!user) {
    await sendNoneUserNotification(bot, msg);
    return;
  }

  let preset_setting = user.preset_setting ?? [0.01, 1, 5, 10];

  // caption for preset buy buttons
  const caption = `⚙ Manual Buy Amount Presets\n\n` +
    `💡 <i>Click on the button that you would like to change the value of</i>`
  const sentMessage = await bot.sendMessage(
    chat_id,
    caption,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Buy ${preset_setting[0]} SOL`,
              callback_data: JSON.stringify({
                'command': `preset_buy_0`
              })
            },
            {
              text: `Buy ${preset_setting[1]} SOL`,
              callback_data: JSON.stringify({
                'command': `preset_buy_1`
              })
            }
          ],
          [
            {
              text: `Buy ${preset_setting[2]} SOL`,
              callback_data: JSON.stringify({
                'command': `preset_buy_2`
              })
            },
            {
              text: `Buy ${preset_setting[3]} SOL`,
              callback_data: JSON.stringify({
                'command': `preset_buy_3`
              })
            }
          ],
          [{
            text: `❌ Dismiss message`,
            callback_data: JSON.stringify({
              'command': 'dismiss_message'
            })
          }]
        ]
      }
    }
  );
}

export const presetBuyAmountScreenHandler = async (bot: TelegramBot, msg: TelegramBot.Message, preset_index: number) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    let key = "preset_index" + username;
    await redisClient.set(key, preset_index);
    const sentMessage = await bot.sendMessage(
      chat_id,
      PRESET_BUY_TEXT,
      {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true,
        }
      }
    );
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
}

export const walletViewHandler = async (bot: TelegramBot,
  msg: TelegramBot.Message) => {
  try {

    const { chat } = msg;
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
    const sentMessage = await bot.sendMessage(
      chat_id,
      caption,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
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
                  'command': `revealpk`
                })
              }]
            }),
            [{
              text: '💳 Generate new wallet', callback_data: JSON.stringify({
                'command': 'generate_wallet'
              })
            }],
            [{
              text: `❌ Dismiss message`,
              callback_data: JSON.stringify({
                'command': 'dismiss_message'
              })
            }]
          ]
        }
      }
    );
  }
  catch (e) {
    console.log("~walletViewHandler~", e);
  }
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
    console.log("~revealWalletPrivatekyHandler~", e);
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
    console.log("~switchWalletHandler~", e);
  }
}

export const setCustomBuyPresetHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id: number
) => {
  try {
    const { id: chat_id, username } = msg.chat
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    let key = "preset_index" + username;
    let preset_index = await redisClient.get(key) ?? "0";
    const user = await UserService.findOne({ username });
    let presetSetting = user?.preset_setting ?? [0.1, 1, 5, 10];
    presetSetting.splice(parseInt(preset_index), 1, amount);
    await UserService.findAndUpdateOne({ username }, { preset_setting: presetSetting });
    const sentSuccessMsg = await bot.sendMessage(chat_id, "Preset value changed successfully!");

    setTimeout(() => {
      bot.deleteMessage(chat_id, sentSuccessMsg.message_id)
    }, 3000);

    setTimeout(() => {
      bot.deleteMessage(chat_id, reply_message_id - 1);
      bot.deleteMessage(chat_id, reply_message_id);
      bot.deleteMessage(chat_id, msg.message_id);
    }, 2000)


  } catch (e) {
    console.log("~ setCustomBuyPresetHandler ~", e)
  }
}
