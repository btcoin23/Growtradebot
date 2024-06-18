import TelegramBot from "node-telegram-bot-api";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  closeReplyMarkup,
  deleteDelayMessage,
  sendNoneUserNotification,
  sendUsernameRequiredNotification,
} from "./common.screen";
import { UserService } from "../services/user.service";
import { copytoclipboard, fromWeiToValue } from "../utils";
import { GrowTradeVersion, MAX_WALLET, private_connection } from "../config";
import { MsgLogService } from "../services/msglog.service";
import redisClient from "../services/redis";
import {
  AUTO_BUY_TEXT,
  PRESET_BUY_TEXT,
  SET_GAS_FEE,
  SET_JITO_FEE,
  TradeBotID,
} from "../bot.opts";
import {
  GasFeeEnum,
  JitoFeeEnum,
  UserTradeSettingService,
} from "../services/user.trade.setting.service";
import { welcomeKeyboardList } from "./welcome.screen";
import { GenerateReferralCode } from "./referral.link.handler";
import { TokenService } from "../services/token.metadata";
import { PNLService } from "../services/pnl.service";
import { RaydiumTokenService } from "../services/raydium.token.service";
import { QuoteRes } from "../services/jupiter.service";
import { JupiterService } from "../services/jupiter.service";
import { NATIVE_MINT } from "@solana/spl-token";
import { calcAmountOut } from "../raydium/raydium.service";
import { getCoinData } from "../pump/api";

export const settingScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  replaceId?: number
) => {
  try {
    const { chat } = msg;
    const { id: chat_id, username } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const user = await UserService.findOne({ username });
    if (!user) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }
    const { wallet_address, auto_buy, auto_buy_amount } = user;

    const caption =
      `<b>GrowTrade ${GrowTradeVersion}</b>\n\n` +
      `<b>AutoBuy</b>\n` +
      `Automatically execute buys upon pasting token address. Customize the Sol amount and press the button to activate/deactivate.\n\n` +
      `<b>Withdraw</b>\n` +
      `Withdraw any token or Solana you have in the currently active wallet.\n\n` +
      `<b>Your active wallet:</b>\n` +
      `${copytoclipboard(wallet_address)}`;

    const reply_markup = await getReplyOptionsForSettings(
      username,
      auto_buy,
      auto_buy_amount
    );

    let sentMessageId = 0;
    if (replaceId) {
      bot.editMessageText(caption, {
        message_id: replaceId,
        chat_id,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup,
      });
      sentMessageId = replaceId;
    } else {
      const sentMessage = await bot.sendMessage(chat_id, caption, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup,
      });
      sentMessageId = sentMessage.message_id;
    }

    await MsgLogService.create({
      username,
      mint: "slippage",
      wallet_address: wallet_address,
      chat_id,
      msg_id: sentMessageId,
      sol_amount: 0,
      spl_amount: 0,
      extra_key: 0,
    });
  } catch (e) {
    console.log("~ settingScreenHandler ~", e);
  }
};

export const presetBuyBtnHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const { chat } = msg;
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
  const caption =
    `⚙ Manual Buy Amount Presets\n\n` +
    `💡 <i>Click on the button that you would like to change the value of</i>`;
  const sentMessage = await bot.sendMessage(chat_id, caption, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `Buy ${preset_setting[0]} SOL`,
            callback_data: JSON.stringify({
              command: `preset_buy_0`,
            }),
          },
          {
            text: `Buy ${preset_setting[1]} SOL`,
            callback_data: JSON.stringify({
              command: `preset_buy_1`,
            }),
          },
        ],
        [
          {
            text: `Buy ${preset_setting[2]} SOL`,
            callback_data: JSON.stringify({
              command: `preset_buy_2`,
            }),
          },
          {
            text: `Buy ${preset_setting[3]} SOL`,
            callback_data: JSON.stringify({
              command: `preset_buy_3`,
            }),
          },
        ],
        [
          {
            text: `❌ Dismiss message`,
            callback_data: JSON.stringify({
              command: "dismiss_message",
            }),
          },
        ],
      ],
    },
  });
};

export const autoBuyAmountScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  replaceId: number
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const key = "autobuy_amount" + username;
    await redisClient.set(key, replaceId);

    const sentMessage = await bot.sendMessage(chat_id, AUTO_BUY_TEXT, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
};

export const presetBuyAmountScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  preset_index: number
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    let key = "preset_index" + username;
    await redisClient.set(key, preset_index);
    const sentMessage = await bot.sendMessage(chat_id, PRESET_BUY_TEXT, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
};

export const walletViewHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const { chat, message_id } = msg;
    const { id: chat_id, username } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const users = await UserService.findAndSort({ username });
    const activeuser = users.filter((user) => user.retired === false)[0];
    const { wallet_address } = activeuser;

    const caption =
      `<b>GrowTrade ${GrowTradeVersion}</b>\n\n<b>Your active wallet:</b>\n` +
      `${copytoclipboard(wallet_address)}`;
    // const sentMessage = await bot.sendMessage(
    // chat_id,
    // caption,
    // {
    await bot.editMessageText(caption, {
      chat_id,
      message_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          ...users.map((user) => {
            const { nonce, wallet_address, retired } = user;
            return [
              {
                text: `${retired ? "🔴" : "🟢"} ${wallet_address}`,
                callback_data: JSON.stringify({
                  command: `wallet_${nonce}`,
                }),
              },
              {
                text: `${retired ? "📌 Use this" : "🪄 In use"}`,
                callback_data: JSON.stringify({
                  command: `usewallet_${nonce}`,
                }),
              },
              {
                text: `🗝 Private key`,
                callback_data: JSON.stringify({
                  command: `revealpk_${nonce}`,
                }),
              },
            ];
          }),
          [
            {
              text: "💳 Generate new wallet",
              callback_data: JSON.stringify({
                command: "generate_wallet",
              }),
            },
          ],
          [
            {
              text: `↩️ Back`,
              callback_data: JSON.stringify({
                command: "settings",
              }),
            },
            {
              text: `❌ Close`,
              callback_data: JSON.stringify({
                command: "dismiss_message",
              }),
            },
          ],
        ],
      },
    });
  } catch (e) {
    console.log("~walletViewHandler~", e);
  }
};

export const generateNewWalletHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const { chat } = msg;
    const { id: chat_id, username, first_name, last_name } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const users = await UserService.find({ username });

    if (users.length >= MAX_WALLET) {
      const limitcaption =
        `<b>You have generated too many wallets. Max limit: ${MAX_WALLET}.</b>\n` +
        `<i>If you need any help, please contact support team.</i>`;
      const sentmsg = await bot.sendMessage(chat_id, limitcaption, {
        parse_mode: "HTML",
      });
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
      wallet_address = keypair.publicKey.toString();

      const wallet = await UserService.findOne({ wallet_address });
      if (!wallet) {
        // add
        const nonce = users.length;
        if (users.length > 0) {
          const olduser = users[0];
          const newUser = {
            chat_id,
            first_name,
            last_name,
            username,
            wallet_address,
            private_key,
            nonce,
            retired: true,
            preset_setting: olduser.preset_setting,
            referrer_code: olduser.referrer_code,
            referrer_wallet: olduser.referrer_wallet,
            referral_code: olduser.referral_code,
            referral_date: olduser.referral_date,
            schedule: olduser.schedule,
            auto_buy: olduser.auto_buy,
            auto_buy_amount: olduser.auto_buy_amount,
            auto_sell_amount: olduser.auto_sell_amount,
            burn_fee: olduser.burn_fee,
          };

          userdata = await UserService.create(newUser); // true; //
        } else {
          const newUser = {
            chat_id,
            username,
            first_name,
            last_name,
            wallet_address,
            private_key,
            nonce,
            retired: true,
          };
          userdata = await UserService.create(newUser); // true; //
        }
      } else {
        retries++;
      }
    } while (retries < 5 && !userdata);

    // impossible to create
    if (!userdata) {
      await bot.sendMessage(
        chat_id,
        "Sorry, we cannot create your account. Please contact support team"
      );
      return;
    }
    // send private key & wallet address
    const caption =
      `👍 Congrates! 👋\n\n` +
      `A new wallet has been generated for you. This is your wallet address\n\n` +
      `${wallet_address}\n\n` +
      `<b>Save this private key below</b>❗\n\n` +
      `<tg-spoiler>${private_key}</tg-spoiler>\n\n`;

    await bot.sendMessage(chat_id, caption, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Dismiss message",
              callback_data: JSON.stringify({
                command: "dismiss_message",
              }),
            },
          ],
        ],
      },
    });
    settingScreenHandler(bot, msg, msg.message_id);
  } catch (e) {
    console.log("~generateNewWalletHandler~", e);
  }
};

export const revealWalletPrivatekyHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  nonce: number
) => {
  try {
    const { chat } = msg;
    const { id: chat_id, username, first_name, last_name } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }
    console.log(username, nonce);
    const user = await UserService.findLastOne({ username, nonce });
    console.log(user);
    if (!user) return;
    // send private key & wallet address
    const caption =
      `🗝 <b>Your private key</b>\n` +
      `<tg-spoiler>${user.private_key}</tg-spoiler>\n\n`;

    await bot.sendMessage(chat_id, caption, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "❌ Dismiss message",
              callback_data: JSON.stringify({
                command: "dismiss_message",
              }),
            },
          ],
        ],
      },
    });
    // settingScreenHandler(bot, msg, msg.message_id);
  } catch (e) {
    console.log("~revealWalletPrivatekyHandler~", e);
  }
};

export const switchWalletHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  nonce: number
) => {
  try {
    const { chat } = msg;
    const { username } = chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    await UserService.findAndUpdateOne(
      { username, retired: false },
      { retired: true }
    );
    await UserService.findAndUpdateOne({ username, nonce }, { retired: false });

    const sentmsg = await bot.sendMessage(chat.id, "Successfully updated");
    deleteDelayMessage(bot, chat.id, sentmsg.message_id, 5000);
    settingScreenHandler(bot, msg, msg.message_id);
  } catch (e) {
    console.log("~switchWalletHandler~", e);
  }
};

export const setCustomBuyPresetHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id: number
) => {
  try {
    const { id: chat_id, username } = msg.chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    let key = "preset_index" + username;
    let preset_index = (await redisClient.get(key)) ?? "0";
    const user = await UserService.findOne({ username });
    let presetSetting = user?.preset_setting ?? [0.1, 1, 5, 10];
    presetSetting.splice(parseInt(preset_index), 1, amount);
    await UserService.updateMany(
      { username },
      { preset_setting: presetSetting }
    );
    const sentSuccessMsg = await bot.sendMessage(
      chat_id,
      "Preset value changed successfully!"
    );

    setTimeout(() => {
      bot.deleteMessage(chat_id, sentSuccessMsg.message_id);
    }, 3000);

    setTimeout(() => {
      bot.deleteMessage(chat_id, reply_message_id - 1);
      bot.deleteMessage(chat_id, reply_message_id);
      bot.deleteMessage(chat_id, msg.message_id);
    }, 2000);
  } catch (e) {
    console.log("~ setCustomBuyPresetHandler ~", e);
  }
};

export const setCustomFeeScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const sentMessage = await bot.sendMessage(chat_id, SET_GAS_FEE, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });

    await MsgLogService.create({
      username,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id,
    });
  } catch (e) {
    console.log("~ setCustomFeeScreenHandler ~", e);
  }
};

export const setCustomFeeHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id: number
) => {
  try {
    const { id: chat_id, username } = msg.chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    // user
    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }

    const msgLog = await MsgLogService.findOne({
      username,
      msg_id: reply_message_id,
    });
    if (!msgLog) {
      return;
    }
    const parent_msgid = msgLog.parent_msgid;

    const parentMsgLog = await MsgLogService.findOne({
      username,
      msg_id: parent_msgid,
    });
    if (!parentMsgLog) {
      return;
    }
    const { mint, extra_key } = parentMsgLog;
    await UserTradeSettingService.setGas(username, {
      gas: GasFeeEnum.CUSTOM,
      value: amount,
    });

    bot.deleteMessage(chat_id, msg.message_id);
    bot.deleteMessage(chat_id, reply_message_id);

    const inline_keyboards = [
      [{ text: '🖼 Generate PNL Card', command: 'pnl_card' }],
      // [{ text: "Slippage: 5%", command: 'set_slippage' }],
      [
        { text: "Buy 0.01 SOL", command: "buytoken_0.01" },
        { text: "Buy 1 SOL", command: "buytoken_1" },
      ],
      [
        { text: "Buy 5 SOL", command: "buytoken_5" },
        { text: "Buy 10 SOL", command: "buytoken_10" },
      ],
      [{ text: "Buy X SOL", command: "buy_custom" }],
      [{ text: "🔁 Switch To Sell", command: "SS_" }],
      [
        { text: "🔄 Refresh", command: "refresh" },
        { text: "❌ Close", command: "dismiss_message" },
      ],
    ];

    let preset_setting = user.preset_setting ?? [0.01, 1, 5, 10];

    if (extra_key == "switch_sell") {
      inline_keyboards[1] = [
        {
          text: `Buy ${preset_setting[0]} SOL`,
          command: `buytoken_${preset_setting[0]}`,
        },
        {
          text: `Buy ${preset_setting[1]} SOL`,
          command: `buytoken_${preset_setting[1]}`,
        },
      ];
      inline_keyboards[2] = [
        {
          text: `Buy ${preset_setting[2]} SOL`,
          command: `buytoken_${preset_setting[2]}`,
        },
        {
          text: `Buy ${preset_setting[3]} SOL`,
          command: `buytoken_${preset_setting[3]}`,
        },
      ];
      inline_keyboards[3] = [{ text: `Buy X SOL`, command: `buy_custom` }];
      inline_keyboards[4] = [
        { text: `🔁 Switch To Sell`, command: `BS_${mint}` },
      ];
    }
    if (extra_key == "switch_buy") {
      inline_keyboards[1] = [
        { text: "Sell 10%", command: `selltoken_10` },
        { text: "Sell 50%", command: `selltoken_50` },
      ];
      inline_keyboards[2] = [
        { text: "Sell 75%", command: `selltoken_75` },
        { text: "Sell 100%", command: `selltoken_100` },
      ];
      inline_keyboards[3] = [{ text: "Sell X%", command: `sell_custom` }];
      inline_keyboards[4] = [
        { text: "🔁 Switch To Buy", command: `SS_${mint}` },
      ];
    }
    const slippageSetting = await UserTradeSettingService.getSlippage(username); // , mint
    inline_keyboards[0][0] = {
      text: `Gas: ${amount} SOL ⚙️`,
      command: "custom_fee",
    };
    // inline_keyboards[1][0].text = `Slippage: ${slippage} %`;

    await bot.editMessageReplyMarkup(
      {
        inline_keyboard: [...inline_keyboards].map((rowItem) =>
          rowItem.map((item) => {
            return {
              text: item.text,
              callback_data: JSON.stringify({
                command: item.command ?? "dummy_button",
              }),
            };
          })
        ),
      },
      {
        message_id: parent_msgid,
        chat_id,
      }
    );
  } catch (e) {
    console.log("~ setCustomBuyPresetHandler ~", e);
  }
};

export const setCustomAutoBuyAmountHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id: number
) => {
  try {
    const { id: chat_id, username } = msg.chat;
    const message_id = msg.message_id;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }
    const user = await UserService.findOne({ username });
    if (!user) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }
    await UserService.updateMany({ username }, { auto_buy_amount: amount });
    const sentSuccessMsg = await bot.sendMessage(
      chat_id,
      "AutoBuy amount changed successfully!"
    );

    const key = "autobuy_amount" + username;
    const replaceId = (await redisClient.get(key)) ?? "0";

    settingScreenHandler(bot, msg, parseInt(replaceId));
    setTimeout(() => {
      bot.deleteMessage(chat_id, sentSuccessMsg.message_id);
    }, 3000);

    setTimeout(() => {
      // bot.deleteMessage(chat_id, reply_message_id - 1);
      bot.deleteMessage(chat_id, reply_message_id);
      bot.deleteMessage(chat_id, msg.message_id);
    }, 2000);
  } catch (e) {
    console.log("~ setCustomAutoBuyHandler ~", e);
  }
};

export const switchBurnOptsHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const message_id = msg.message_id;
    const sentMessage = await bot.sendMessage(msg.chat.id, "Updating...");

    const username = msg.chat.username;
    if (!username) {
      await bot.deleteMessage(msg.chat.id, message_id);
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const user = await UserService.findOne({ username });
    if (!user) {
      await sendUsernameRequiredNotification(bot, msg);
      await bot.deleteMessage(msg.chat.id, sentMessage.message_id);
      return;
    }

    await UserService.updateMany({ username }, { burn_fee: !user.burn_fee });
    // console.log("🚀 ~ switchBurnOptsHandler ~ user.burn_fee:", user.burn_fee)

    if (!user.burn_fee) {
      const caption =
        `Burn: On 🔥\n\n` +
        `GrowTrade's burn functionality operates seamlessly through its fee system, where a portion of tokens bought and sold is systematically burned. This process does not affect users' own tokens but only those acquired through the fee mechanism, ensuring the safety of your trades.`;
      bot.sendMessage(msg.chat.id, caption, closeReplyMarkup);
    }
    const reply_markup = {
      inline_keyboard: welcomeKeyboardList.map((rowItem) =>
        rowItem.map((item) => {
          if (item.command.includes("bridge")) {
            return {
              text: item.text,
              url: "https://t.me/growbridge_bot",
            };
          }
          if (item.text.includes("Burn")) {
            const burnText = `${
              !user.burn_fee ? "Burn: On 🔥" : "Burn: Off ♨️"
            }`;
            return {
              text: burnText,
              callback_data: JSON.stringify({
                command: item.command,
              }),
            };
          }
          return {
            text: item.text,
            callback_data: JSON.stringify({
              command: item.command,
            }),
          };
        })
      ),
    };

    await bot.editMessageReplyMarkup(reply_markup, {
      message_id,
      chat_id: msg.chat.id,
    });

    await bot.deleteMessage(msg.chat.id, sentMessage.message_id);
  } catch (error) {
    console.log("🚀 ~ switchBurnOptsHandler ~ error:", error);
  }
};

export const switchAutoBuyOptsHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const message_id = msg.message_id;
    const sentMessage = await bot.sendMessage(msg.chat.id, "Updating...");

    const username = msg.chat.username;
    if (!username) {
      await bot.deleteMessage(msg.chat.id, sentMessage.message_id);
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const user = await UserService.findOne({ username });
    if (!user) {
      await bot.deleteMessage(msg.chat.id, sentMessage.message_id);
      await sendNoneUserNotification(bot, msg);
      return;
    }

    const isAutoBuy = !user.auto_buy;
    await UserService.updateMany({ username }, { auto_buy: isAutoBuy });

    const reply_markup = await getReplyOptionsForSettings(
      username,
      isAutoBuy,
      user.auto_buy_amount
    );

    await bot.editMessageReplyMarkup(reply_markup, {
      message_id,
      chat_id: msg.chat.id,
    });

    await bot.deleteMessage(msg.chat.id, sentMessage.message_id);
  } catch (error) {
    console.log("🚀 ~ switchAutoBuyOptsHandler ~ error:", error);
  }
};

export const getReplyOptionsForSettings = async (
  username: string,
  auto_buy: boolean,
  auto_buy_amount: string
) => {
  // Slippage
  const slippageSetting = await UserTradeSettingService.getSlippage(username);

  const gasSetting = await UserTradeSettingService.getGas(username);
  const gasvalue = UserTradeSettingService.getGasValue(gasSetting);
  // JitoFee
  const jitoFeeSetting = await UserTradeSettingService.getJitoFee(username);
  const jitoFeeValue = UserTradeSettingService.getJitoFeeValue(jitoFeeSetting);

  const { slippage } = slippageSetting;

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `💳 Wallet`,
          callback_data: JSON.stringify({
            command: `wallet_view`,
          }),
        },
        {
          text: `🗒  Preset Settings`,
          callback_data: JSON.stringify({
            command: `preset_setting`,
          }),
        },
      ],
      [
        {
          text: "♻️ Withdraw",
          callback_data: JSON.stringify({
            command: `transfer_funds`,
          }),
        },
        {
          text: `〰️ Slippage: ${slippage} %`,
          callback_data: JSON.stringify({
            command: `set_slippage`,
          }),
        },
      ],
      [
        {
          text: `${!auto_buy ? "Autobuy ☑️" : "Autobuy ✅"}`,
          callback_data: JSON.stringify({
            command: `autobuy_switch`,
          }),
        },
        {
          text: `${auto_buy_amount} SOL`,
          callback_data: JSON.stringify({
            command: `autobuy_amount`,
          }),
        },
      ],
      [
        {
          text: "--- MEV PROTECT ---",
          callback_data: JSON.stringify({
            command: `dump`,
          }),
        },
      ],
      [
        {
          text: `🔁 ${jitoFeeSetting.jitoOption}`,
          callback_data: JSON.stringify({
            command: `switch_mev`,
          }),
        },
        {
          text: `⚙️ ${jitoFeeValue} SOL`,
          callback_data: JSON.stringify({
            command: `custom_jitofee`,
          }),
        },
      ],
      [
        {
          text: "--- PRIORITY FEES ---",
          callback_data: JSON.stringify({
            command: `dump`,
          }),
        },
      ],
      [
        { 
          text: `${(gasSetting.gas === GasFeeEnum.LOW ? "🟢" : "🔴")} Low Gas`,
          callback_data: JSON.stringify({
            command: 'low_gas' 
          }),
        },
        { 
          text: `${(gasSetting.gas === GasFeeEnum.MEDIUM ? "🟢" : "🔴")} Medium Gas`, 
          callback_data: JSON.stringify({
            command: 'medium_gas' 
          }),
        },
        { 
          text: `${(gasSetting.gas === GasFeeEnum.HIGH ? "🟢" : "🔴")} High Gas`, 
          callback_data: JSON.stringify({
          command: 'high_gas' 
          }),
        },
      ],
      [
        {
          text: `${
            gasSetting.gas === GasFeeEnum.CUSTOM ? "🟢" : ""
          } Gas: ${gasvalue} SOL ⚙️`,
          callback_data: JSON.stringify({
            command: "custom_fee",
          }),
        }
      ],
      [
        {
          text: "↩️ Back",
          callback_data: JSON.stringify({
            command: "back_home",
          }),
        },
        {
          text: "❌ Close",
          callback_data: JSON.stringify({
            command: "dismiss_message",
          }),
        },
      ],
    ],
  };

  return reply_markup;
};

export const changeJitoTipFeeHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const chat_id = msg.chat.id;
  const caption = msg.text;
  const username = msg.chat.username;
  const reply_markup = msg.reply_markup;
  if (!caption || !username || !reply_markup) return;

  const { jitoOption, value } = await UserTradeSettingService.getJitoFee(
    username
  );
  const nextFeeOption =
    UserTradeSettingService.getNextJitoFeeOption(jitoOption);
  const nextValue = UserTradeSettingService.getJitoFeeValue({
    jitoOption: nextFeeOption,
  });

  await UserTradeSettingService.setJitoFee(username, {
    jitoOption: nextFeeOption,
    value: nextValue,
  });

  let inline_keyboard = reply_markup.inline_keyboard;
  inline_keyboard[4] = [
    {
      text: `🔁 ${nextFeeOption}`,
      callback_data: JSON.stringify({
        command: `switch_mev`,
      }),
    },
    {
      text: `⚙️ ${nextValue} SOL`,
      callback_data: JSON.stringify({
        command: `custom_jitofee`,
      }),
    },
  ];

  bot.sendMessage(chat_id, `MEV protect set to ${nextFeeOption}.`);

  await bot.editMessageReplyMarkup(
    {
      inline_keyboard,
    },
    {
      message_id: msg.message_id,
      chat_id,
    }
  );
};

export const setCustomJitoFeeScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const sentMessage = await bot.sendMessage(chat_id, SET_JITO_FEE, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });

    await MsgLogService.create({
      username,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id,
    });
  } catch (e) {
    console.log("~ setCustomFeeScreenHandler ~", e);
  }
};

export const setCustomJitoFeeHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id: number
) => {
  try {
    const { id: chat_id, username } = msg.chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    // user
    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }
    const { auto_buy, auto_buy_amount } = user;

    const msgLog = await MsgLogService.findOne({
      username,
      msg_id: reply_message_id,
    });
    if (!msgLog) {
      return;
    }
    const parent_msgid = msgLog.parent_msgid;

    const parentMsgLog = await MsgLogService.findOne({
      username,
      msg_id: parent_msgid,
    });
    if (!parentMsgLog) {
      return;
    }
    await UserTradeSettingService.setJitoFee(username, {
      jitoOption: JitoFeeEnum.CUSTOM,
      value: amount,
    });

    bot.deleteMessage(chat_id, msg.message_id);
    bot.deleteMessage(chat_id, reply_message_id);

    const reply_markup = await getReplyOptionsForSettings(
      username,
      auto_buy,
      auto_buy_amount
    );
    bot.sendMessage(chat_id, `MEV protect set to ${amount} SOL.`);

    await bot.editMessageReplyMarkup(reply_markup, {
      message_id: parent_msgid,
      chat_id,
    });
  } catch (e) {
    console.log("~ setCustomBuyPresetHandler ~", e);
  }
};

export const pnlCardHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;

    const pendingTxMsg = await bot.sendMessage(
      chat_id,
      `🕒 <b>Generating PNL Card...</b>\n`,
      {
        parse_mode: "HTML",
      }
    );

    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id,
    });
    if (!msglog) return;
    const { mint } = msglog;
    let tokenSymbol;
    const referrerCode = await GenerateReferralCode(username);
    const { symbol } = await TokenService.fetchSimpleMetaData(
      new PublicKey(mint)
    );
    tokenSymbol = symbol
    if(tokenSymbol === ''){
      const tokeninfo = await TokenService.getMintInfo(mint);
      tokenSymbol = tokeninfo?.overview.symbol;
    }

    const solPrice = await TokenService.getSOLPrice();
    const metadata = await TokenService.getMintMetadata(
      private_connection,
      new PublicKey(mint)
    );
    const decimals = metadata?.parsed.info.decimals;

    const isToken2022 = metadata?.program === "spl-token-2022";
    const splbalance = await TokenService.getSPLBalance(
      mint,
      user.wallet_address,
      isToken2022,
      true
    );
    let quote: QuoteRes | null;

    const jupiterService = new JupiterService();
    const jupiterTradeable = await jupiterService.checkTradableOnJupiter(mint);
    if (jupiterTradeable) {
      quote = await jupiterService.getQuote(
        mint,
        NATIVE_MINT.toString(),
        splbalance,
        Number(decimals),
        9
      );
    } else {
      const raydiumPoolInfo = await RaydiumTokenService.findLastOne({ mint });
      if (raydiumPoolInfo) {
        const { name, symbol, mint, poolId, isAmm, ammKeys, clmmKeys } =
          raydiumPoolInfo;
        quote = (await calcAmountOut(
          private_connection,
          new PublicKey(mint),
          Number(decimals),
          NATIVE_MINT,
          9,
          poolId,
          splbalance,
          isAmm,
          ammKeys,
          clmmKeys
        )) as QuoteRes;
      } else {
        const coinData = await getCoinData(mint);
        if (!coinData) {
          console.error("Failed to retrieve coin data...");
          return;
        }
        const _slippage = 0.25;
        const minSolOutput = Math.floor(
          (splbalance *
            10 ** Number(decimals) *
            (1 - _slippage) *
            coinData["virtual_sol_reserves"]) /
            coinData["virtual_token_reserves"]
        );
        quote = {
          inAmount: splbalance,
          outAmount: fromWeiToValue(minSolOutput, 9),
        } as QuoteRes;
      }
    }
    const pnlService = new PNLService(user.wallet_address, mint, quote);
    interface PNLData {
      profitInSOL: number;
      percent: number;
    }
    await pnlService.initialize();
    const pnldata = (await pnlService.getPNLInfo()) as PNLData;
    const boughtInSOL = await pnlService.getBoughtAmount();
    const { profitInSOL, percent } = pnldata
      ? pnldata
      : { profitInSOL: Number(0), percent: Number(0) };
    const profitInUSD = profitInSOL * Number(solPrice);
    console.log(
      "PNL data ->",
      profitInSOL,
      profitInUSD,
      solPrice,
      splbalance,
      boughtInSOL,
      pnldata
    );
    const req = {
      chatId: chat_id,
      pairTitle: `${tokenSymbol}/SOL`,
      boughtAmount: Number(boughtInSOL).toFixed(2),
      pnlValue: Number(profitInSOL).toFixed(2),
      worth: Math.abs(Number(profitInUSD)).toFixed(2),
      profitPercent: Number(percent).toFixed(2),
      burnAmount: Number(0).toFixed(2),
      isBuy: splbalance > 0,
      referralLink: `https://t.me/${TradeBotID}?start=${referrerCode}`,
    };
    const { pnlUrl } = await pnlService.getPNLCard(req);
    console.log(req);
    await bot.deleteMessage(msg.chat.id, pendingTxMsg.message_id);
    await bot.sendPhoto(msg.chat.id, pnlUrl, {
      parse_mode: "HTML",
    });
  } catch (e) {
    console.log("~ refresh handler ~", e);
  }
};
