import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import {
  Liquidity,
  LiquidityPoolKeys,
  Market,
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  publicKey,
  struct,
  MAINNET_PROGRAM_ID,
  LiquidityStateV4,
  BNLayout,
} from "@raydium-io/raydium-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MinimalMarketLayoutV3 } from "../market";

export const RAYDIUM_LIQUIDITY_PROGRAM_ID_CLMM = MAINNET_PROGRAM_ID.CLMM;
export const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = MAINNET_PROGRAM_ID.AmmV4;
export const OPENBOOK_PROGRAM_ID = MAINNET_PROGRAM_ID.OPENBOOK_MARKET;

export const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
  publicKey("eventQueue"),
  publicKey("bids"),
  publicKey("asks"),
]);

export function createPoolKeys(
  id: PublicKey,
  accountData: LiquidityStateV4,
  minimalMarketLayoutV3: MinimalMarketLayoutV3
): LiquidityPoolKeys {
  return {
    id,
    baseMint: accountData.baseMint,
    quoteMint: accountData.quoteMint,
    lpMint: accountData.lpMint,
    baseDecimals: Number(accountData.baseDecimal), // .toNumber(),
    quoteDecimals: Number(accountData.quoteDecimal), // .toNumber(),
    lpDecimals: 5,
    version: 4,
    programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    authority: Liquidity.getAssociatedAuthority({
      programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    }).publicKey,
    openOrders: accountData.openOrders,
    targetOrders: accountData.targetOrders,
    baseVault: accountData.baseVault,
    quoteVault: accountData.quoteVault,
    marketVersion: 3,
    marketProgramId: accountData.marketProgramId,
    marketId: accountData.marketId,
    marketAuthority: Market.getAssociatedAuthority({
      programId: accountData.marketProgramId,
      marketId: accountData.marketId,
    }).publicKey,
    marketBaseVault: accountData.baseVault,
    marketQuoteVault: accountData.quoteVault,
    marketBids: minimalMarketLayoutV3.bids,
    marketAsks: minimalMarketLayoutV3.asks,
    marketEventQueue: minimalMarketLayoutV3.eventQueue,
    withdrawQueue: accountData.withdrawQueue,
    lpVault: accountData.lpVault,
    lookupTableAccount: PublicKey.default,
  };
}

export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
  commitment?: Commitment
) {
  const tokenResp = await connection.getTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID,
    },
    commitment
  );

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      programId: account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

export const convertDBForPoolStateV4 = (poolstate: any) => {
  return {
    status: poolstate.status,
    nonce: poolstate.nonce,
    maxOrder: poolstate.maxOrder,
    depth: poolstate.depth,
    baseDecimal: poolstate.baseDecimal,
    quoteDecimal: poolstate.quoteDecimal,
    state: poolstate.state,
    resetFlag: poolstate.resetFlag,
    minSize: poolstate.minSize,
    volMaxCutRatio: poolstate.volMaxCutRatio,
    amountWaveRatio: poolstate.amountWaveRatio,
    baseLotSize: poolstate.baseLotSize,
    quoteLotSize: poolstate.quoteLotSize,
    minPriceMultiplier: poolstate.minPriceMultiplier,
    maxPriceMultiplier: poolstate.maxPriceMultiplier,
    systemDecimalValue: poolstate.systemDecimalValue,
    minSeparateNumerator: poolstate.minSeparateNumerator,
    minSeparateDenominator: poolstate.minSeparateDenominator,
    tradeFeeNumerator: poolstate.tradeFeeNumerator,
    tradeFeeDenominator: poolstate.tradeFeeDenominator,
    pnlNumerator: poolstate.pnlNumerator,
    pnlDenominator: poolstate.pnlDenominator,
    swapFeeNumerator: poolstate.swapFeeNumerator,
    swapFeeDenominator: poolstate.swapFeeDenominator,
    baseNeedTakePnl: poolstate.baseNeedTakePnl,
    quoteNeedTakePnl: poolstate.quoteNeedTakePnl,
    quoteTotalPnl: poolstate.quoteTotalPnl,
    baseTotalPnl: poolstate.baseTotalPnl,
    poolOpenTime: poolstate.poolOpenTime,
    punishPcAmount: poolstate.punishPcAmount,
    punishCoinAmount: poolstate.punishCoinAmount,
    orderbookToInitTime: poolstate.orderbookToInitTime,
    swapBaseInAmount: poolstate.swapBaseInAmount,
    swapQuoteOutAmount: poolstate.swapQuoteOutAmount,
    swapBase2QuoteFee: poolstate.swapBase2QuoteFee,
    swapQuoteInAmount: poolstate.swapQuoteInAmount,
    swapBaseOutAmount: poolstate.swapBaseOutAmount,
    swapQuote2BaseFee: poolstate.swapQuote2BaseFee,
    baseVault: new PublicKey(poolstate.baseVault),
    quoteVault: new PublicKey(poolstate.quoteVault),
    baseMint: new PublicKey(poolstate.baseMint),
    quoteMint: new PublicKey(poolstate.quoteMint),
    lpMint: new PublicKey(poolstate.lpMint),
    openOrders: new PublicKey(poolstate.openOrders),
    marketId: new PublicKey(poolstate.marketId),
    marketProgramId: new PublicKey(poolstate.marketProgramId),
    targetOrders: new PublicKey(poolstate.targetOrders),
    withdrawQueue: new PublicKey(poolstate.withdrawQueue),
    lpVault: new PublicKey(poolstate.lpVault),
    owner: new PublicKey(poolstate.owner),
    lpReserve: poolstate.lpReserve,
  } as LiquidityStateV4;
};
