import { BIRDEYE_API_URL, REQUEST_HEADER } from "../config";

export const BirdEyeAPIService = {
  getTokenOverview: (mint: string | undefined | null) => {
    return new Promise((resolve, reject) => {
      if (!mint) {
        reject(new Error('Mint address is not provided'));
        return;
      }
      const url = BIRDEYE_API_URL + '/defi/token_overview?address=' + mint;
      const options = { method: 'GET', headers: REQUEST_HEADER };
      fetch(url, options)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch data');
          }
          return response.json();
        })
        .then(data => resolve(data.data))
        .catch(err => reject(err));
    });
  },
  getTokenSecurity: (mint: string | undefined | null) => {
    return new Promise((resolve, reject) => {
      if (!mint) {
        reject(new Error('Mint address is not provided'));
        return;
      }
      const url = BIRDEYE_API_URL + '/defi/token_security?address=' + mint;
      const options = { method: 'GET', headers: REQUEST_HEADER };
      fetch(url, options)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch data');
          }
          return response.json();
        })
        .then(data => resolve(data.data))
        .catch(err => reject(err));
    });
  },
  getTokenCreationInfo: (mint: string | undefined | null) => {
    return new Promise((resolve, reject) => {
      if (!mint) {
        reject(new Error('Mint address is not provided'));
        return;
      }
      const url = BIRDEYE_API_URL + '/defi/token_creation_info?address=' + mint;
      const options = { method: 'GET', headers: REQUEST_HEADER };
      fetch(url, options)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch data');
          }
          return response.json();
        })
        .then(data => resolve(data.data))
        .catch(err => reject(err));
    });
  },
}

export interface TokenOverviewDataType {
  "address": string,
  "decimals": number,
  "symbol"?: string
  "name"?: string
  "extensions"?: {
    "coingeckoId"?: string
    "serumV3Usdc"?: string
    "serumV3Usdt"?: string
    "website"?: string
    "telegram"?: string
    "twitter"?: string
    "description"?: string
    "discord"?: string
    "medium"?: string
  },
  "logoURI"?: string
  "liquidity": number,
  "price": number,
  "history30mPrice": number,
  "priceChange30mPercent": number,
  "history1hPrice": number,
  "priceChange1hPercent": number,
  "history2hPrice": number,
  "priceChange2hPercent": number,
  "history4hPrice": number,
  "priceChange4hPercent": number,
  "history6hPrice": number,
  "priceChange6hPercent": number,
  "history8hPrice": number,
  "priceChange8hPercent": number,
  "history12hPrice": number,
  "priceChange12hPercent": number,
  "history24hPrice": number,
  "priceChange24hPercent": number,
  "uniqueWallet30m": number,
  "uniqueWalletHistory30m": number,
  "uniqueWallet30mChangePercent": number,
  "uniqueWallet1h": number,
  "uniqueWalletHistory1h": number,
  "uniqueWallet1hChangePercent": number,
  "uniqueWallet2h": number,
  "uniqueWalletHistory2h": number,
  "uniqueWallet2hChangePercent": number,
  "uniqueWallet4h": number,
  "uniqueWalletHistory4h": number,
  "uniqueWallet4hChangePercent": number,
  "uniqueWallet6h": number,
  "uniqueWalletHistory6h": number,
  "uniqueWallet6hChangePercent": number,
  "uniqueWallet8h": number,
  "uniqueWalletHistory8h": number,
  "uniqueWallet8hChangePercent": number,
  "uniqueWallet12h": number,
  "uniqueWalletHistory12h": number,
  "uniqueWallet12hChangePercent": number,
  "uniqueWallet24h": number,
  "uniqueWalletHistory24h": number,
  "uniqueWallet24hChangePercent": number,
  "lastTradeUnixTime": number,
  "lastTradeHumanTime"?: string
  "supply": number,
  "mc": number,
  "trade30m": number,
  "tradeHistory30m": number,
  "trade30mChangePercent": number,
  "sell30m": number,
  "sellHistory30m": number,
  "sell30mChangePercent": number,
  "buy30m": number,
  "buyHistory30m": number,
  "buy30mChangePercent": number,
  "v30m": number,
  "v30mUSD": number,
  "vHistory30m": number,
  "vHistory30mUSD": number,
  "v30mChangePercent": number,
  "vBuy30m": number,
  "vBuy30mUSD": number,
  "vBuyHistory30m": number,
  "vBuyHistory30mUSD": number,
  "vBuy30mChangePercent": number,
  "vSell30m": number,
  "vSell30mUSD": number,
  "vSellHistory30m": number,
  "vSellHistory30mUSD": number,
  "vSell30mChangePercent": number,
  "trade1h": number,
  "tradeHistory1h": number,
  "trade1hChangePercent": number,
  "sell1h": number,
  "sellHistory1h": number,
  "sell1hChangePercent": number,
  "buy1h": number,
  "buyHistory1h": number,
  "buy1hChangePercent": number,
  "v1h": number,
  "v1hUSD": number,
  "vHistory1h": number,
  "vHistory1hUSD": number,
  "v1hChangePercent": number,
  "vBuy1h": number,
  "vBuy1hUSD": number,
  "vBuyHistory1h": number,
  "vBuyHistory1hUSD": number,
  "vBuy1hChangePercent": number,
  "vSell1h": number,
  "vSell1hUSD": number,
  "vSellHistory1h": number,
  "vSellHistory1hUSD": number,
  "vSell1hChangePercent": number,
  "trade2h": number,
  "tradeHistory2h": number,
  "trade2hChangePercent": number,
  "sell2h": number,
  "sellHistory2h": number,
  "sell2hChangePercent": number,
  "buy2h": number,
  "buyHistory2h": number,
  "buy2hChangePercent": number,
  "v2h": number,
  "v2hUSD": number,
  "vHistory2h": number,
  "vHistory2hUSD": number,
  "v2hChangePercent": number,
  "vBuy2h": number,
  "vBuy2hUSD": number,
  "vBuyHistory2h": number,
  "vBuyHistory2hUSD": number,
  "vBuy2hChangePercent": number,
  "vSell2h": number,
  "vSell2hUSD": number,
  "vSellHistory2h": number,
  "vSellHistory2hUSD": number,
  "vSell2hChangePercent": number,
  "trade4h": number,
  "tradeHistory4h": number,
  "trade4hChangePercent": number,
  "sell4h": number,
  "sellHistory4h": number,
  "sell4hChangePercent": number,
  "buy4h": number,
  "buyHistory4h": number,
  "buy4hChangePercent": number,
  "v4h": number,
  "v4hUSD": number,
  "vHistory4h": number,
  "vHistory4hUSD": number,
  "v4hChangePercent": number,
  "vBuy4h": number,
  "vBuy4hUSD": number,
  "vBuyHistory4h": number,
  "vBuyHistory4hUSD": number,
  "vBuy4hChangePercent": number,
  "vSell4h": number,
  "vSell4hUSD": number,
  "vSellHistory4h": number,
  "vSellHistory4hUSD": number,
  "vSell4hChangePercent": number,
  "trade6h": number,
  "tradeHistory6h": number,
  "trade6hChangePercent": number,
  "sell6h": number,
  "sellHistory6h": number,
  "sell6hChangePercent": number,
  "buy6h": number,
  "buyHistory6h": number,
  "buy6hChangePercent": number,
  "v6h": number,
  "v6hUSD": number,
  "vHistory6h": number,
  "vHistory6hUSD": number,
  "v6hChangePercent": number,
  "vBuy6h": number,
  "vBuy6hUSD": number,
  "vBuyHistory6h": number,
  "vBuyHistory6hUSD": number,
  "vBuy6hChangePercent": number,
  "vSell6h": number,
  "vSell6hUSD": number,
  "vSellHistory6h": number,
  "vSellHistory6hUSD": number,
  "vSell6hChangePercent": number,
  "trade8h": number,
  "tradeHistory8h": number,
  "trade8hChangePercent": number,
  "sell8h": number,
  "sellHistory8h": number,
  "sell8hChangePercent": number,
  "buy8h": number,
  "buyHistory8h": number,
  "buy8hChangePercent": number,
  "v8h": number,
  "v8hUSD": number,
  "vHistory8h": number,
  "vHistory8hUSD": number,
  "v8hChangePercent": number,
  "vBuy8h": number,
  "vBuy8hUSD": number,
  "vBuyHistory8h": number,
  "vBuyHistory8hUSD": number,
  "vBuy8hChangePercent": number,
  "vSell8h": number,
  "vSell8hUSD": number,
  "vSellHistory8h": number,
  "vSellHistory8hUSD": number,
  "vSell8hChangePercent": number,
  "trade12h": number,
  "tradeHistory12h": number,
  "trade12hChangePercent": number,
  "sell12h": number,
  "sellHistory12h": number,
  "sell12hChangePercent": number,
  "buy12h": number,
  "buyHistory12h": number,
  "buy12hChangePercent": number,
  "v12h": number,
  "v12hUSD": number,
  "vHistory12h": number,
  "vHistory12hUSD": number,
  "v12hChangePercent": number,
  "vBuy12h": number,
  "vBuy12hUSD": number,
  "vBuyHistory12h": number,
  "vBuyHistory12hUSD": number,
  "vBuy12hChangePercent": number,
  "vSell12h": number,
  "vSell12hUSD": number,
  "vSellHistory12h": number,
  "vSellHistory12hUSD": number,
  "vSell12hChangePercent": number,
  "trade24h": number,
  "tradeHistory24h": number,
  "trade24hChangePercent": number,
  "sell24h": number,
  "sellHistory24h": number,
  "sell24hChangePercent": number,
  "buy24h": number,
  "buyHistory24h": number,
  "buy24hChangePercent": number,
  "v24h": number,
  "v24hUSD": number,
  "vHistory24h": number,
  "vHistory24hUSD": number,
  "v24hChangePercent": number,
  "vBuy24h": number,
  "vBuy24hUSD": number,
  "vBuyHistory24h": number,
  "vBuyHistory24hUSD": number,
  "vBuy24hChangePercent": number,
  "vSell24h": number,
  "vSell24hUSD": number,
  "vSellHistory24h": number,
  "vSellHistory24hUSD": number,
  "vSell24hChangePercent": number,
  "watch": number,
  "view30m": number,
  "viewHistory30m": number,
  "view30mChangePercent": number,
  "view1h": number,
  "viewHistory1h": number,
  "view1hChangePercent": number,
  "view2h": number,
  "viewHistory2h": number,
  "view2hChangePercent": number,
  "view4h": number,
  "viewHistory4h": number,
  "view4hChangePercent": number,
  "view6h": number,
  "viewHistory6h": number,
  "view6hChangePercent": number,
  "view8h": number,
  "viewHistory8h": number,
  "view8hChangePercent": number,
  "view12h": number,
  "viewHistory12h": number,
  "view12hChangePercent": number,
  "view24h": number,
  "viewHistory24h": number,
  "view24hChangePercent": number,
  "uniqueView30m": number,
  "uniqueViewHistory30m": number,
  "uniqueView30mChangePercent": number,
  "uniqueView1h": number,
  "uniqueViewHistory1h": number,
  "uniqueView1hChangePercent": number,
  "uniqueView2h": number,
  "uniqueViewHistory2h": number,
  "uniqueView2hChangePercent": number,
  "uniqueView4h": number,
  "uniqueViewHistory4h": number,
  "uniqueView4hChangePercent": number,
  "uniqueView6h": number,
  "uniqueViewHistory6h": number,
  "uniqueView6hChangePercent": number,
  "uniqueView8h": number,
  "uniqueViewHistory8h": number,
  "uniqueView8hChangePercent": number,
  "uniqueView12h": number,
  "uniqueViewHistory12h": number,
  "uniqueView12hChangePercent": number,
  "uniqueView24h": number,
  "uniqueViewHistory24h": number,
  "uniqueView24hChangePercent": number,
  "numberMarkets": number,
}

export interface TokenSecurityInfoDataType {
  "creatorAddress"?: string,
  "ownerAddress"?: string,
  "creationTx"?: number,
  "creationTime"?: number,
  "creationSlot"?: number,
  "mintTx"?: string,
  "mintTime"?: number,
  "mintSlot"?: number,
  "creatorBalance"?: number,
  "ownerBalance"?: number,
  "ownerPercentage"?: number,
  "creatorPercentage"?: number,
  "metaplexUpdateAuthority"?: string,
  "metaplexUpdateAuthorityBalance"?: number,
  "metaplexUpdateAuthorityPercent"?: number,
  "mutableMetadata"?: boolean,
  "top10HolderBalance"?: number,
  "top10HolderPercent"?: number,
  "top10UserBalance"?: number,
  "top10UserPercent"?: number,
  "isTrueToken"?: boolean,
  "totalSupply"?: number,
  "preMarketHolder": [],
  "lockInfo"?: string,
  "freezeable"?: string,
  "freezeAuthority"?: string,
  "transferFeeEnable"?: string,
  "transferFeeData"?: string,
  "isToken2022": boolean,
  "nonTransferable"?: string,
}

export interface TokenCreationInfoDataType {
  "txHash"?: string,
  "slot"?: number,
  "tokenAddress"?: string,
  "decimals"?: number,
  "owner"?: string
}