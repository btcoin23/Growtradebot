import TelegramBot from "node-telegram-bot-api";
import { TokenService } from "../services/token.metadata";
import {
  birdeyeLink,
  contractLink,
  copytoclipboard,
  dexscreenerLink,
  dextoolLink,
  formatKMB,
  formatPrice,
  fromWeiToValue,
} from "../utils";
import { UserService } from "../services/user.service";
import {
  sendNoneExistTokenNotification,
  sendNoneUserNotification,
  sendUsernameRequiredNotification,
} from "./common.screen";
import {
  GasFeeEnum,
  UserTradeSettingService,
} from "../services/user.trade.setting.service";
import { MsgLogService } from "../services/msglog.service";
import { autoBuyHandler } from "./trade.screen";
import { JupiterService, QuoteRes } from "../services/jupiter.service";
import { NATIVE_MINT } from "@solana/spl-token";
import { PNLService } from "../services/pnl.service";
import { RaydiumTokenService } from "../services/raydium.token.service";
import {
  PNL_SHOW_THRESHOLD_USD,
  RAYDIUM_PASS_TIME,
  connection,
  private_connection,
} from "../config";
import { PublicKey } from "@solana/web3.js";
import { getTop10HoldersPercent } from "../raydium";
import {
  calcAmountOut,
  syncAmmPoolKeys,
  syncClmmPoolKeys,
} from "../raydium/raydium.service";
import { getCoinData } from "../pump/api";
import { TokenSecurityInfoDataType } from "../services/birdeye.api.service";

export const inline_keyboards = [
  [ { text: '🖼 Generate PNL Card', command: 'pnl_card' }],
  [
    { text: "Buy 0.01 SOL", command: "buytoken_0.01" },
    { text: "Buy 1 SOL", command: "buytoken_1" },
  ],
  [
    { text: "Buy 5 SOL", command: "buytoken_5" },
    { text: "Buy 10 SOL", command: "buytoken_10" },
  ],
  [ { text: "Buy X SOL", command: "buy_custom" }],
  [ { text: "🔁 Switch To Sell", command: "SS_" }],
  [
    { text: "🔄 Refresh", command: "refresh" },
    { text: "❌ Close", command: "dismiss_message" },
  ],
];

export const contractInfoScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  mint: string,
  switchBtn?: string,
  fromPosition?: boolean
) => {
  try {
    const { id: chat_id, username } = msg.chat;
    if (!username) {
      await sendUsernameRequiredNotification(bot, msg);
      return;
    }

    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }

    const pending = await bot.sendMessage(chat_id, "Loading...");


    let caption = "";
    let solbalance = 0;
    let splbalance = 0;
    // Here, we need to get info from raydium token list
    const raydiumPoolInfo = await RaydiumTokenService.findLastOne({ mint });
    let isJupiterTradable = false;
    let isPumpfunTradable = false;
    if (!raydiumPoolInfo) {
      const jupiterSerivce = new JupiterService();
      const jupiterTradeable = await jupiterSerivce.checkTradableOnJupiter(
        mint
      );
      if (!jupiterTradeable) {
        isPumpfunTradable = true;
      } else {
        isJupiterTradable = jupiterTradeable;
      }
    } else {
      const { creation_ts } = raydiumPoolInfo;
      const duration = Date.now() - creation_ts;
      // 120minutes
      if (duration < RAYDIUM_PASS_TIME) {
        isJupiterTradable = false;
      } else {
        const jupiterSerivce = new JupiterService();
        const jupiterTradeable = await jupiterSerivce.checkTradableOnJupiter(
          mint
        );
        isJupiterTradable = jupiterTradeable;
      }
    }
    console.log("IsJupiterTradeable", isJupiterTradable);

    if (isPumpfunTradable) {
      const captionForPump = await getPumpTokenInfoCaption(
        mint,
        user.wallet_address
      );

      if (!captionForPump) {
        bot.deleteMessage(chat_id, pending.message_id);
        await sendNoneExistTokenNotification(bot, msg);
        return;
      }
      bot.deleteMessage(chat_id, pending.message_id);
      caption = captionForPump.caption;
      solbalance = captionForPump.solbalance;
      splbalance = captionForPump.splbalance;
    } else if (raydiumPoolInfo && !isJupiterTradable) {

      // 120minutes
      // if (duration < RAYDIUM_PASS_TIME) {
      const captionForRaydium = await getRaydiumTokenInfoCaption(
        raydiumPoolInfo,
        user.wallet_address
      );
      if (!captionForRaydium) {
        bot.deleteMessage(chat_id, pending.message_id);
        return;
      }
      bot.deleteMessage(chat_id, pending.message_id);
      caption = captionForRaydium.caption;
      solbalance = captionForRaydium.solbalance;
      splbalance = captionForRaydium.splbalance;
      // }
    } else {
      // check token metadata
      const tokeninfo = await TokenService.getMintInfo(mint);
      if (!tokeninfo) {
        bot.deleteMessage(chat_id, pending.message_id);
        await sendNoneExistTokenNotification(bot, msg);
        return;
      }
      const captionForJuipter = await getJupiterTokenInfoCaption(
        tokeninfo,
        mint,
        user.wallet_address
      );

      if (!captionForJuipter) {
        bot.deleteMessage(chat_id, pending.message_id);
        return;
      }
      bot.deleteMessage(chat_id, pending.message_id);
      caption = captionForJuipter.caption;
      solbalance = captionForJuipter.solbalance;
      splbalance = captionForJuipter.splbalance;
    }

    const preset_setting = user.preset_setting ?? [0.01, 1, 5, 10];

    if (switchBtn == "switch_buy") {
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
    } else {
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

    const slippageSetting = await UserTradeSettingService.getSlippage(username); // , mint
    const gasSetting = await UserTradeSettingService.getGas(username);
    const { slippage } = slippageSetting;
    const gasvalue = UserTradeSettingService.getGasValue(gasSetting);


    if (switchBtn && !fromPosition) {
      const sentMessage = bot.editMessageReplyMarkup(
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
          message_id: msg.message_id,
          chat_id,
        }
      );
      await MsgLogService.create({
        username,
        mint,
        wallet_address: user.wallet_address,
        chat_id,
        msg_id: msg.message_id,
        sol_amount: solbalance,
        spl_amount: splbalance,
        extra_key: switchBtn,
      });
    } else {
      const sentMessage = await bot.sendMessage(chat_id, caption, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
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
      });

      await MsgLogService.create({
        username,
        mint,
        wallet_address: user.wallet_address,
        chat_id,
        msg_id: sentMessage.message_id,
        sol_amount: solbalance,
        spl_amount: splbalance,
        extra_key: switchBtn,
      });
    }

    if (!switchBtn || switchBtn.includes("sell")) {
      const autoBuyAmount = parseFloat(user.auto_buy_amount);
      console.log(
        "🚀 ~ contractInfoScreenHandler ~ autoBuyAmount:",
        autoBuyAmount
      );
      if (user.auto_buy) {
        console.log(
          "🚀 ~ contractInfoScreenHandler ~ user.auto_buy:",
          user.auto_buy
        );
        await autoBuyHandler(
          bot,
          msg,
          user,
          mint,
          autoBuyAmount,
          solbalance,
          gasvalue,
          slippage
        );
      }
    }
  } catch (e) {
    console.log("~ contractInfoScreenHandler ~", e);
  }
};

const getRaydiumTokenInfoCaption = async (
  raydiumPoolInfo: any,
  wallet_address: string
) => {
  try {
    // Raydium Info
    const { name, symbol, mint, poolId, isAmm, ammKeys, clmmKeys } =
      raydiumPoolInfo;

    let tokenName = name;
    let tokenSymbol = symbol;
    if (tokenName === "" || tokenSymbol === "") {
      const { name, symbol } = await TokenService.fetchSimpleMetaData(
        new PublicKey(mint)
      );
      tokenName = name;
      tokenSymbol = symbol;
      RaydiumTokenService.findOneAndUpdate({
        filter: { poolId },
        data: { name, symbol },
      });
    }

    // Metadata
    const metadata = await TokenService.getMintMetadata(
      private_connection,
      new PublicKey(mint)
    );
    if (!metadata) return;
    const decimals = metadata.parsed.info.decimals;

    const isToken2022 = metadata.program === "spl-token-2022";

    // Balance
    const solprice = await TokenService.getSOLPrice();
    const splbalance = await TokenService.getSPLBalance(
      mint,
      wallet_address,
      isToken2022,
      true
    );
    const solbalance = await TokenService.getSOLBalance(wallet_address);

    // const splvalue = priceInUsd * splbalance;

    const quoteTemp = (await calcAmountOut(
      connection,
      new PublicKey(mint),
      decimals,
      NATIVE_MINT,
      9,
      poolId,
      splbalance,
      isAmm,
      ammKeys,
      clmmKeys
    )) as QuoteRes;

    const quote = splbalance > 0 ? quoteTemp : null;

    const priceInSOL = quoteTemp.priceInSol; //  await getPriceInSOL(mint);
    const priceInUsd = (priceInSOL ?? 0) * solprice;
    const priceImpact = quote ? quote.priceImpactPct : 0;

    const supply = Number(metadata.parsed.info.supply) / 10 ** Number(decimals);
    // const liquidity = baseBalance;
    const circulateSupply = supply; // - liquidity;

    const freezeAuthority = metadata.parsed.info.freezeAuthority;
    const mintAuthority = metadata.parsed.info.mintAuthority;

    const top10HolderPercent = await getTop10HoldersPercent(
      private_connection,
      mint,
      supply
      // poolState.baseVault
    );
    const price = priceInUsd;
    const mc = circulateSupply * price;
    console.log("Raydium Quote: ", quote);

    const caption = await buildCaption(
      tokenName,
      tokenSymbol,
      isToken2022,
      mint,
      quote,
      wallet_address,
      mintAuthority,
      freezeAuthority,
      top10HolderPercent,
      price,
      priceImpact,
      mc,
      solprice,
      solbalance,
      splbalance
    );
    if (isAmm && !ammKeys) {
      syncAmmPoolKeys(poolId);
    }
    if (!isAmm && !clmmKeys) {
      syncClmmPoolKeys(poolId);
    }
    return {
      caption,
      solbalance,
      splbalance,
    };
  } catch (e) {
    console.log('- Error while getting RaydiumTokenInfoCaption...', e);
    return null;
  }
};

const getJupiterTokenInfoCaption = async (
  tokeninfo: any,
  mint: string,
  wallet_address: string
) => {
  try {
    const { overview, secureinfo } = tokeninfo;
    const { symbol, name, price, mc, decimals } = overview;
    const { isToken2022, ownerAddress, freezeAuthority, top10HolderPercent } =
      secureinfo;

    const solprice = await TokenService.getSOLPrice();
    const splbalance = await TokenService.getSPLBalance(
      mint,
      wallet_address,
      isToken2022,
      true
    );
    const solbalance = await TokenService.getSOLBalance(wallet_address);

    // SELL simulate
    const splvalue = splbalance * price;
    const jupiterService = new JupiterService();
    const quote =
      splvalue > PNL_SHOW_THRESHOLD_USD
        ? await jupiterService.getQuote(
            mint,
            NATIVE_MINT.toString(),
            splbalance,
            decimals,
            9
          )
        : null;
    const priceImpact = quote ? quote.priceImpactPct : 0;

    console.log("Jupiter Quote", quote);

    const caption = await buildCaption(
      name,
      symbol,
      isToken2022,
      mint,
      quote,
      wallet_address,
      ownerAddress,
      freezeAuthority,
      top10HolderPercent,
      price,
      priceImpact,
      mc,
      solprice,
      solbalance,
      splbalance
    );
    return {
      caption,
      solbalance,
      splbalance,
    };
  } catch (e) {
    return null;
  }
};

const getPumpTokenInfoCaption = async (
  mintStr: string,
  wallet_address: string
) => {
  try {
    // Raydium Info
    const coinData = await getCoinData(mintStr);
    if (!coinData) {
      console.error("Failed to retrieve coin data...");
      return;
    }

    let tokenName = coinData["name"];
    let tokenSymbol = coinData["symbol"];
    const mc = coinData["usd_market_cap"];
    const totalSupply = coinData["total_supply"];
    if (tokenName === "" || tokenSymbol === "") {
      const { name, symbol } = await TokenService.fetchSimpleMetaData(
        new PublicKey(mintStr)
      );
      tokenName = name;
      tokenSymbol = symbol;
    }

    // Metadata
    const metadata = await TokenService.getMintMetadata(
      private_connection,
      new PublicKey(mintStr)
    );
    if (!metadata) return;

    const isToken2022 = metadata.program === "spl-token-2022";

    // Balance
    const solprice = await TokenService.getSOLPrice();
    const splbalance = await TokenService.getSPLBalance(
      mintStr,
      wallet_address,
      isToken2022,
      true
    );
    const solbalance = await TokenService.getSOLBalance(wallet_address);

    const decimals = metadata.parsed.info.decimals;
    const priceInUsd = mc / (totalSupply / 10 ** decimals);
    const splvalue = priceInUsd * splbalance;
    const _slippage = 0.25;
    const minSolOutput = Math.floor(
      (splbalance *
        10 ** decimals *
        (1 - _slippage) *
        coinData["virtual_sol_reserves"]) /
        coinData["virtual_token_reserves"]
    );
    // const quote = { inAmount: splbalance, outAmount: fromWeiToValue(minSolOutput, 9) } as QuoteRes
    const quote =
      splvalue > PNL_SHOW_THRESHOLD_USD
        ? ({
            inAmount: splbalance,
            outAmount: fromWeiToValue(minSolOutput, 9),
          } as QuoteRes)
        : null;
    const priceImpact = 0;
    console.log("Pump Quote", quote);

    const freezeAuthority = metadata.parsed.info.freezeAuthority;
    const mintAuthority = metadata.parsed.info.mintAuthority;

    const secuInf = (await TokenService.getTokenSecurity(
      mintStr
    )) as TokenSecurityInfoDataType;
    const top10HolderPercent = secuInf.top10HolderPercent as number;
    const price = priceInUsd;

    const caption = await buildCaption(
      tokenName,
      tokenSymbol,
      isToken2022,
      mintStr,
      quote,
      wallet_address,
      mintAuthority,
      freezeAuthority,
      top10HolderPercent,
      price,
      priceImpact,
      mc,
      solprice,
      solbalance,
      splbalance
    );

    return {
      caption,
      solbalance,
      splbalance,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
};

const buildCaption = async (
  name: string,
  symbol: string,
  isToken2022: boolean,
  mint: string,
  quote: QuoteRes | null,
  wallet_address: string,
  mintAuthority: any,
  freezeAuthority: any,
  top10HolderPercent: number,
  price: number,
  priceImpact: number,
  mc: number,
  solprice: number,
  solbalance: number,
  splbalance: number
) => {
  let caption = "";
  let boughtInSOL = 0;
  let profitInSOL = 0;
  let pnlPercent = 0;
  caption +=
    `🌳 Token: <b>${name ?? "undefined"} (${symbol ?? "undefined"})</b> ` +
    `${isToken2022 ? "<i>Token2022</i>" : ""}\n` +
    `<i>${copytoclipboard(mint)}</i>\n\n`;

  const pnlService = new PNLService(wallet_address, mint, quote);
  await pnlService.initialize();
  const pnldata = await pnlService.getPNLInfo();
  boughtInSOL = (await pnlService.getBoughtAmount()) as number;
  if (pnldata) {
    const { profitInSOL: profitSol, percent } = pnldata;
    profitInSOL = profitSol;
    pnlPercent = percent;
  }
  const profitInUSD = profitInSOL * Number(solprice);

  caption += `<b>PNL:</b> ${pnlPercent.toFixed(3)}% [${profitInSOL.toFixed(
    3
  )} Sol | ${profitInUSD.toFixed(2)}$] ${pnlPercent > 0 ? "🟩" : "🟥"} \n\n`;
  caption +=
    `🌳 Mint Disabled: ${mintAuthority ? "🔴" : "🍏"}\n` +
    `🌳 Freeze Disabled: ${freezeAuthority ? "🔴" : "🍏"}\n` +
    `👥 Top 10 holders: ${
      top10HolderPercent && (top10HolderPercent > 0.15 ? "🔴" : "🍏")
    }  [ ${
      top10HolderPercent && (top10HolderPercent * 100)?.toFixed(2)
    }% ]\n\n` +
    `💲 Price: <b>$${formatPrice(price)}</b>\n` +
    `💸 Price Impact: [${priceImpact.toFixed(4)} %]\n` +
    `📊 Market Cap: <b>$${formatKMB(mc)}</b>\n\n` +
    `💳 <b>Balance: ${solbalance.toFixed(6)} SOL\n` +
    `💳 Token: ${splbalance} ${symbol ?? ""}</b>\n` +
    `${contractLink(mint)} • ${birdeyeLink(mint)} • ${dextoolLink(
      mint
    )} • ${dexscreenerLink(mint)}`;

  return caption;
};


export const refreshHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const chat_id = msg.chat.id;
    const username = msg.chat.username;
    const reply_markup = msg.reply_markup;
    if (!username || !reply_markup) return;

    // user
    const user = await UserService.findOne({ username });
    if (!user) {
      await sendNoneUserNotification(bot, msg);
      return;
    }
    bot.deleteMessage(chat_id, msg.message_id);

    const msglog = await MsgLogService.findOne({
      username,
      msg_id: msg.message_id,
    });
    if (!msglog) return;
    const { mint } = msglog;

    await contractInfoScreenHandler(bot, msg, mint);
  } catch (e) {
    console.log("~ refresh handler ~", e);
  }
};
