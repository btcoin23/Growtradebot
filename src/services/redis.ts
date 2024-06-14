import { createClient } from 'redis';
import { REDIS_URI } from '../config';
import { GasFeeEnum } from './user.trade.setting.service';
import { TokenOverviewDataType, TokenSecurityInfoDataType } from './birdeye.api.service';

const redisClient = createClient({
  url: REDIS_URI
});

export default redisClient;

// [username_mint] => { chatId, slippage, slippagebps, gasSetting }
// [mint_price] => price           # every 10 seconds
// [mint_overview] => overview     # every 6 hour (MC)
// [mint_secureinfo] => secureinfo # 1day
// [wallet_tokenaccounts] => Array<mint, balance>
export interface ITradeSlippageSetting {
  chatId?: number;
  slippage: number;
  slippagebps: number;
  wallet?: string
}

export interface ITradeGasSetting {
  gas: GasFeeEnum;
  value?: number;
}

export interface IMintPrice {
  price: number
}

export interface IMintOverview {
  overview: TokenOverviewDataType;
}

export interface IMintSecureInfo {
  secureinfo: TokenSecurityInfoDataType;
}
