import TelegramBot, { InlineKeyboardMarkup } from "node-telegram-bot-api";
import { JupiterService, QuoteRes } from "../services/jupiter.service";
import { TokenService } from "../services/token.metadata";
import { closeReplyMarkup, deleteDelayMessage } from "./common.screen";
import { UserService } from "../services/user.service";
import {
  BUY_XSOL_TEXT,
  PRESET_BUY_TEXT,
  SELL_XPRO_TEXT,
  SET_SLIPPAGE_TEXT,
} from "../bot.opts";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  GasFeeEnum,
  UserTradeSettingService,
} from "../services/user.trade.setting.service";
import { MsgLogService } from "../services/msglog.service";
import { inline_keyboards } from "./contract.info.screen";
import { copytoclipboard, fromWeiToValue } from "../utils";
import bs58 from "bs58";
import {
  RAYDIUM_PASS_TIME,
  RESERVE_WALLET,
  connection,
  private_connection,
} from "../config";
import { getSignatureStatus, sendTransactionV0 } from "../utils/v0.transaction";
import {
  checkReferralFeeSent,
  get_referral_info,
} from "../services/referral.service";
import { PNLService } from "../services/pnl.service";
import { RaydiumSwapService, getPriceInSOL } from "../raydium/raydium.service";
import { RaydiumTokenService } from "../services/raydium.token.service";
import { getMintMetadata } from "../raydium";

export const buyCustomAmountScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id,
    });
    if (!msglog) return;
    const { mint } = msglog;
    if (!mint) return;

    const sentMessage = await bot.sendMessage(chat_id, BUY_XSOL_TEXT, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });

    await MsgLogService.create({
      username,
      mint,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id,
    });
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
};

export const sellCustomAmountScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const caption = msg.text;
    const username = msg.chat.username;
    const user = await UserService.findOne({ username });
    if (!user) return;
    if (!caption || !username) return;
    const mint = getTokenMintFromCallback(caption);
    if (!mint) return;

    const sentMessage = await bot.sendMessage(chat_id, SELL_XPRO_TEXT, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });

    await MsgLogService.create({
      username,
      mint,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id,
    });
  } catch (e) {
    console.log("~sellCustomAmountScreenHandler~", e);
  }
};

export const setSlippageScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    if (!username) return;
    const user = await UserService.findOne({ username });
    if (!user) return;

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id,
    });
    if (!msglog) return;
    const { mint } = msglog;

    if (!mint) return;

    const sentMessage = await bot.sendMessage(chat_id, SET_SLIPPAGE_TEXT, {
      parse_mode: "HTML",
      reply_markup: {
        force_reply: true,
      },
    });

    await MsgLogService.create({
      username,
      mint,
      wallet_address: user.wallet_address,
      chat_id,
      msg_id: sentMessage.message_id,
      parent_msgid: msg.message_id,
    });
  } catch (e) {
    console.log("~buyCustomAmountScreenHandler~", e);
  }
};

export const buyHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  amount: number,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;
  console.log("Buy1:", Date.now());
  const user = await UserService.findOne({ username });
  if (!user) return;
  console.log("Buy2:", Date.now());

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id ?? msg.message_id,
  });
  // console.log("🚀 ~ msglog:", msglog)
  // console.log("🚀 ~ msg.message_id:", msg.message_id)
  console.log("Buy3:", Date.now());

  if (!msglog) return;
  const { mint, sol_amount } = msglog;

  const gassetting = await UserTradeSettingService.getGas(username);
  console.log("Buy4:", Date.now());

  const gasvalue = UserTradeSettingService.getGasValue(gassetting);
  if (!mint) return;
  // Insufficient check check if enough includes fee
  if (sol_amount && sol_amount <= amount + gasvalue) {
    bot
      .sendMessage(
        chat_id,
        "<b>⚠️ Insufficient SOL balance!</b>",
        closeReplyMarkup
      )
      .then((sentMessage) => {
        setTimeout(() => {
          bot.deleteMessage(chat_id, sentMessage.message_id);
        }, 5000);
      });
    return;
  }

  let name = "";
  let symbol = "";
  let decimals = 9;
  let isToken2022 = false;
  let isRaydium = true;
  const raydiumPoolInfo = await RaydiumTokenService.findLastOne({ mint });
  const jupiterSerivce = new JupiterService();
  const isJupiterTradable = await jupiterSerivce.checkTradableOnJupiter(mint);
  if (!raydiumPoolInfo && !isJupiterTradable) {
    return;
  }
  if (raydiumPoolInfo && !isJupiterTradable) {
    // const { creation_ts } = raydiumPoolInfo;
    // const duration = Date.now() - creation_ts;
    // if (duration < RAYDIUM_PASS_TIME) {
    // Metadata
    const metadata = await getMintMetadata(
      private_connection,
      new PublicKey(mint)
    );
    if (!metadata) return;
    isToken2022 = metadata.program === "spl-token-2022";
    const tokenDetails = await TokenService.getTokenOverview(mint)
    name = tokenDetails.name;
    symbol = tokenDetails.symbol;
    decimals = metadata.parsed.info.decimals;
    // }
  } else {
    const mintinfo = await TokenService.getMintInfo(mint);
    if (!mintinfo) return;
    isRaydium = false;
    name = mintinfo.overview.name || "";
    symbol = mintinfo.overview.symbol || "";
    decimals = mintinfo.overview.decimals || 9;
    isToken2022 = mintinfo.secureinfo.isToken2022;
  }
  console.log("Buy5:", Date.now());

  const solprice = await TokenService.getSOLPrice();
  console.log("Buy6:", Date.now());

  // send Notification
  const getcaption = (status: string, suffix: string = "") => {
    const securecaption =
      `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${copytoclipboard(mint)}</i>\n` +
      status +
      `💲 <b>Value: ${amount} SOL ($ ${(amount * solprice).toFixed(3)})</b>\n` +
      suffix;

    return securecaption;
  };
  const buycaption = getcaption(`🕒 <b>Buy in progress</b>\n`);
  console.log("Buy7:", Date.now());

  const pendingTxMsg = await bot.sendMessage(chat_id, buycaption, {
    parse_mode: "HTML",
  });
  const pendingTxMsgId = pendingTxMsg.message_id;
  console.log("Buy8:", Date.now());

  const { slippage } = await UserTradeSettingService.getSlippage(
    username,
    mint
  );
  console.log("Buy start:", Date.now());
  // buy token
  const raydiumService = new RaydiumSwapService();
  // const jupiterSerivce = new JupiterService();
  console.log("Raydium Swap?", isRaydium, isJupiterTradable);
  const quoteResult = isRaydium
    ? await raydiumService.swapToken(
      user.private_key,
      NATIVE_MINT.toBase58(),
      mint,
      9, // SOL decimal
      amount,
      slippage,
      gasvalue,
      user.burn_fee ?? true,
      username,
      isToken2022
    )
    : await jupiterSerivce.swapToken(
      user.private_key,
      NATIVE_MINT.toBase58(),
      mint,
      9, // SOL decimal
      amount,
      slippage,
      gasvalue,
      user.burn_fee ?? true,
      username,
      isToken2022
    );

  if (quoteResult) {
    const { signature, total_fee_in_sol, quote } = quoteResult;
    const suffix = `📈 Txn: <a href="https://solscan.io/tx/${signature}">${signature}</a>\n`;
    const successCaption = getcaption(`🟢 <b>Buy Success</b>\n`, suffix);

    // Just in case
    try {
      await bot.editMessageText(successCaption, {
        message_id: pendingTxMsgId,
        chat_id,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
      });
    } catch (e) { }

    const status = await getSignatureStatus(signature);
    if (!status) {
      const failedCaption = getcaption(`🔴 <b>Buy Failed</b>\n`, suffix);
      await bot.editMessageCaption(failedCaption, {
        message_id: pendingTxMsgId,
        chat_id,
        parse_mode: "HTML",
      });
      return;
    }

    // Buy with SOL.
    const { inAmount, outAmount } = quote;
    const inAmountNum = fromWeiToValue(inAmount, 9);
    const outAmountNum = fromWeiToValue(outAmount, decimals);

    const pnlservice = new PNLService(user.wallet_address, mint);
    await pnlservice.afterBuy(inAmountNum, outAmountNum);

    // Update Referral System
    await checkReferralFeeSent(total_fee_in_sol, username);
  } else {
    const failedCaption = getcaption(`🔴 <b>Buy Failed</b>\n`);
    await bot.editMessageText(failedCaption, {
      message_id: pendingTxMsgId,
      chat_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
    });
  }
};

export const autoBuyHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  user: any,
  mint: string,
  amount: number,
  sol_amount: number,
  gasvalue: number,
  slippage: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;
  // Insufficient check check if enough includes fee
  if (sol_amount && sol_amount <= amount + gasvalue) {
    bot
      .sendMessage(
        chat_id,
        "<b>⚠️ Insufficient SOL balance!</b>",
        closeReplyMarkup
      )
      .then((sentMessage) => {
        setTimeout(() => {
          bot.deleteMessage(chat_id, sentMessage.message_id);
        }, 5000);
      });
    return;
  }

  let name = "";
  let symbol = "";
  let decimals = 9;
  let isToken2022 = false;
  let isRaydium = true;
  const raydiumPoolInfo = await RaydiumTokenService.findLastOne({ mint });

  const jupiterSerivce = new JupiterService();
  const isJupiterTradable = await jupiterSerivce.checkTradableOnJupiter(mint);
  if (!raydiumPoolInfo && !isJupiterTradable) {
    return;
  }
  if (raydiumPoolInfo && !isJupiterTradable) {
    // if (raydiumPoolInfo && !isJupiterTradable) {
    // if (raydiumPoolInfo) {
    // const { creation_ts } = raydiumPoolInfo;
    // const duration = Date.now() - creation_ts;
    // if (duration < RAYDIUM_PASS_TIME) {
    // Metadata
    const metadata = await getMintMetadata(
      private_connection,
      new PublicKey(mint)
    );
    if (!metadata) return;
    isToken2022 = metadata.program === "spl-token-2022";
    const tokenDetails = await TokenService.getTokenOverview(mint)
    name = tokenDetails.name;
    symbol = tokenDetails.symbol;
    decimals = metadata.parsed.info.decimals;
    // }
  } else {
    const mintinfo = await TokenService.getMintInfo(mint);
    if (!mintinfo) return;
    isRaydium = false;
    name = mintinfo.overview.name || "";
    symbol = mintinfo.overview.symbol || "";
    decimals = mintinfo.overview.decimals || 9;
    isToken2022 = mintinfo.secureinfo.isToken2022;
  }

  const solprice = await TokenService.getSOLPrice();
  console.log("AutoBuy1:", Date.now());

  // send Notification
  const getcaption = (status: string, suffix: string = "") => {
    const securecaption =
      `<b>AutoBuy</b>\n\n🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"
      })</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${copytoclipboard(mint)}</i>\n` +
      status +
      `💲 <b>Value: ${amount} SOL ($ ${(amount * solprice).toFixed(3)})</b>\n` +
      suffix;

    return securecaption;
  };
  const buycaption = getcaption(`🕒 <b>Buy in progress</b>\n`);

  const pendingTxMsg = await bot.sendMessage(chat_id, buycaption, {
    parse_mode: "HTML",
  });
  const pendingTxMsgId = pendingTxMsg.message_id;
  console.log("Buy start:", Date.now());

  // buy token
  const raydiumService = new RaydiumSwapService();
  // const jupiterSerivce = new JupiterService();
  const quoteResult = isRaydium
    ? await raydiumService.swapToken(
      user.private_key,
      NATIVE_MINT.toBase58(),
      mint,
      9, // SOL decimal
      amount,
      slippage,
      gasvalue,
      user.burn_fee ?? true,
      username,
      isToken2022
    )
    : await jupiterSerivce.swapToken(
      user.private_key,
      NATIVE_MINT.toBase58(),
      mint,
      9, // SOL decimal
      amount,
      slippage,
      gasvalue,
      user.burn_fee ?? true,
      username,
      isToken2022
    );

  if (quoteResult) {
    const { signature, total_fee_in_sol, quote } = quoteResult;
    const suffix = `📈 Txn: <a href="https://solscan.io/tx/${signature}">${signature}</a>\n`;
    const successCaption = getcaption(`🟢 <b>Buy Success</b>\n`, suffix);

    // Just in case
    try {
      await bot.editMessageText(successCaption, {
        message_id: pendingTxMsgId,
        chat_id,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
      });
    } catch (e) { }

    const status = await getSignatureStatus(signature);
    if (!status) {
      const failedCaption = getcaption(`🔴 <b>Buy Failed</b>\n`);
      await bot.editMessageCaption(failedCaption, {
        message_id: pendingTxMsgId,
        chat_id,
        parse_mode: "HTML",
      });
      return;
    }

    // Buy with SOL.
    const { inAmount, outAmount } = quote;
    const inAmountNum = fromWeiToValue(inAmount, 9);
    const outAmountNum = fromWeiToValue(outAmount, decimals);

    const pnlservice = new PNLService(user.wallet_address, mint);
    await pnlservice.afterBuy(inAmountNum, outAmountNum);

    // Update Referral System
    await checkReferralFeeSent(total_fee_in_sol, username);
  } else {
    const failedCaption = getcaption(`🔴 <b>Buy Failed</b>\n`);
    await bot.editMessageText(failedCaption, {
      message_id: pendingTxMsgId,
      chat_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
    });
  }
};

export const sellHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  percent: number,
  reply_message_id?: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const user = await UserService.findOne({ username });
  if (!user) return;

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id ?? msg.message_id,
  });
  // console.log("🚀 ~ msg.message_id:", msg.message_id)
  // console.log("🚀 ~ msglog:", msglog)

  if (!msglog) return;
  const { mint, spl_amount, sol_amount } = msglog;

  if (!mint) return;
  // check if enough includes fee
  if (sol_amount && sol_amount <= 0.0005) {
    bot
      .sendMessage(
        chat_id,
        "<b>⚠️ Insufficient SOL balance for gas fee!</b>",
        closeReplyMarkup
      )
      .then((sentMessage) => {
        setTimeout(() => {
          bot.deleteMessage(chat_id, sentMessage.message_id);
        }, 10000);
      });
    return;
  }

  // const mintinfo = await TokenService.getMintInfo(mint);

  // if (!mintinfo) return;
  // const { name, symbol, price, decimals } = mintinfo.overview;
  // const { isToken2022 } = mintinfo.secureinfo;
  let name = "";
  let symbol = "";
  let decimals = 9;
  let price = 0;
  let isToken2022 = false;
  let isRaydium = true;
  const raydiumPoolInfo = await RaydiumTokenService.findLastOne({ mint });

  const jupiterSerivce = new JupiterService();
  const isJupiterTradable = await jupiterSerivce.checkTradableOnJupiter(mint);

  if (!raydiumPoolInfo && !isJupiterTradable) {
    return;
  }
  if (raydiumPoolInfo && !isJupiterTradable) {
    // if (raydiumPoolInfo) {
    const { creation_ts } = raydiumPoolInfo;
    const duration = Date.now() - creation_ts;
    if (duration < RAYDIUM_PASS_TIME) {
      // Metadata
      const metadata = await getMintMetadata(
        private_connection,
        new PublicKey(mint)
      );
      if (!metadata) return;
      isToken2022 = metadata.program === "spl-token-2022";

      decimals = metadata.parsed.info.decimals;

      const priceInSOL = await getPriceInSOL(mint);

      const solprice = await TokenService.getSOLPrice();
      price = priceInSOL * solprice;
    }
  } else {
    const mintinfo = await TokenService.getMintInfo(mint);
    if (!mintinfo) return;
    isRaydium = false;
    name = mintinfo.overview.name || "";
    symbol = mintinfo.overview.symbol || "";
    decimals = mintinfo.overview.decimals || 9;
    isToken2022 = mintinfo.secureinfo.isToken2022;
    price = mintinfo.overview.price || 0;
  }

  const splbalance = await TokenService.getSPLBalance(
    mint,
    user.wallet_address,
    isToken2022
  );
  const sellAmount = (splbalance * percent) / 100;

  // send Notification
  const getcaption = (status: string, suffix: string = "") => {
    const securecaption =
      `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
      `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
      `<i>${copytoclipboard(mint)}</i>\n` +
      status +
      `💲 <b>Value: ${sellAmount} ${symbol} ($ ${(sellAmount * price).toFixed(
        3
      )})</b>\n` +
      suffix;
    return securecaption;
  };

  const buycaption = getcaption(`🕒 <b>Sell in progress</b>\n`);
  const pendingMessage = await bot.sendMessage(chat_id, buycaption, {
    parse_mode: "HTML",
  });

  // sell token
  const { slippage } = await UserTradeSettingService.getSlippage(
    username,
    mint
  );
  const gassetting = await UserTradeSettingService.getGas(username);
  const gasvalue = UserTradeSettingService.getGasValue(gassetting);

  const raydiumService = new RaydiumSwapService();
  // const jupiterSerivce = new JupiterService();
  const quoteResult = isRaydium
    ? await raydiumService.swapToken(
      user.private_key,
      mint,
      NATIVE_MINT.toBase58(),
      decimals,
      sellAmount,
      slippage,
      gasvalue,
      user.burn_fee ?? true,
      username,
      isToken2022
    )
    : await jupiterSerivce.swapToken(
      user.private_key,
      mint,
      NATIVE_MINT.toBase58(),
      decimals,
      sellAmount,
      slippage,
      gasvalue,
      user.burn_fee ?? true,
      username,
      isToken2022
    );

  if (quoteResult) {
    const { signature, total_fee_in_sol, quote } = quoteResult;
    const suffix = `📈 Txn: <a href="https://solscan.io/tx/${signature}">${signature}</a>\n`;
    const successCaption = getcaption(`🟢 <b>Sell Success</b>\n`, suffix);

    await bot.editMessageText(successCaption, {
      message_id: pendingMessage.message_id,
      chat_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
    });

    const status = await getSignatureStatus(signature);
    if (!status) {
      const failedCaption = getcaption(`🔴 <b>Sell Failed</b>\n`);
      await bot.editMessageCaption(failedCaption, {
        message_id: pendingMessage.message_id,
        chat_id,
        parse_mode: "HTML",
      });
      return;
    }

    // Sell token for SOL.
    const { inAmount, outAmount } = quote;
    const inAmountNum = fromWeiToValue(inAmount, decimals);
    const outAmountNum = fromWeiToValue(outAmount, 9);

    const pnlservice = new PNLService(user.wallet_address, mint);
    await pnlservice.afterSell(outAmountNum, percent);

    // Update Referral System
    await checkReferralFeeSent(total_fee_in_sol, username);
  } else {
    const failedCaption = getcaption(`🔴 <b>Sell Failed</b>\n`);
    await bot.editMessageText(failedCaption, {
      message_id: pendingMessage.message_id,
      chat_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: closeReplyMarkup.reply_markup as InlineKeyboardMarkup,
    });
  }
};

export const setSlippageHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  percent: number,
  reply_message_id: number
) => {
  const chat_id = msg.chat.id;
  const username = msg.chat.username;
  if (!username) return;

  const msglog = await MsgLogService.findOne({
    username,
    msg_id: reply_message_id,
  });
  if (!msglog) return;
  const { mint, parent_msgid, msg_id } = msglog;

  if (!mint) return;

  await UserTradeSettingService.setSlippage(username, mint, {
    slippage: percent,
    slippagebps: percent * 100,
  });

  const gassetting = await UserTradeSettingService.getGas(username);
  const gaskeyboards = await UserTradeSettingService.getGasInlineKeyboard(
    gassetting.gas
  );
  const gasvalue = UserTradeSettingService.getGasValue(gassetting);

  inline_keyboards[0][0] = {
    text: `${gassetting.gas === GasFeeEnum.CUSTOM ? "🟢" : ""
      } Gas: ${gasvalue} SOL ⚙️`,
    command: "custom_fee",
  };
  inline_keyboards[1][0].text = `Slippage: ${percent} %`;

  await bot.editMessageReplyMarkup(
    {
      inline_keyboard: [gaskeyboards, ...inline_keyboards].map((rowItem) =>
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
  bot.deleteMessage(chat_id, msg_id);
  bot.deleteMessage(chat_id, msg.message_id);
};

const getTokenMintFromCallback = (caption: string | undefined) => {
  if (caption === undefined || caption === "") return null;
  const data = caption.split("\n")[1];
  if (data === undefined) return null;
  return data as string;
};

// Deprecated: Don't use this
export const feeHandler = async (
  total_fee_in_sol: number,
  total_fee_in_token: number,
  username: string,
  pk: string,
  mint: string,
  isToken2022: boolean
) => {
  if (username) return;
  try {
    const wallet = Keypair.fromSecretKey(bs58.decode(pk));
    let ref_info = await get_referral_info(username);
    console.log("🚀 ~ ref_info:", ref_info);
    let referralWallet;
    if (ref_info?.referral_address) {
      console.log(
        "🚀 ~ ref_info?.referral_address:",
        ref_info?.referral_address
      );
      referralWallet = new PublicKey(ref_info?.referral_address);
    } else {
      referralWallet = RESERVE_WALLET;
    }
    console.log("🚀 ~ referralWallet:", referralWallet);
    const referralFeePercent = ref_info?.referral_option ?? 0; // 25%

    const referralFee = Number(
      ((total_fee_in_sol * referralFeePercent) / 100).toFixed(0)
    );
    const reserverStakingFee = total_fee_in_sol - referralFee;

    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10000,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 50000,
      }),
    ];
    if (reserverStakingFee > 0) {
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: RESERVE_WALLET,
          lamports: reserverStakingFee,
        })
      );
    }

    if (referralFee > 0) {
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: referralWallet,
          lamports: referralFee,
        })
      );
    }

    if (total_fee_in_token) {
      // Burn
      const ata = getAssociatedTokenAddressSync(
        new PublicKey(mint),
        wallet.publicKey,
        true,
        isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      );
      instructions.push(
        createBurnInstruction(
          ata,
          new PublicKey(mint),
          wallet.publicKey,
          BigInt(total_fee_in_token),
          [],
          isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
        )
      );
    }
  } catch (e) {
    console.log("- Fee handler has issue", e);
  }
};
