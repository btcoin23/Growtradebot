import redisClient, { ITradeGasSetting, ITradeSlippageSetting } from "./redis";

export enum GasFeeEnum {
  LOW = 'low',
  HIGH = 'high',
  MEDIUM = 'medium',
  CUSTOM = 'custom'
}

export const UserTradeSettingService = {
  // , mint: string
  getSlippage: async (username: string) => {
    // const key = `${username}_${mint}`;
    const key = `${username}_slippage`;
    const data = await redisClient.get(key);
    if (data) return JSON.parse(data) as ITradeSlippageSetting;
    return {
      slippage: 20,
      slippagebps: 2000,
    } as ITradeSlippageSetting
  },
  // , mint: string
  setSlippage: async (username: string, opts: ITradeSlippageSetting) => {
    // const key = `${username}_${mint}`;
    const key = `${username}_slippage`;
    await redisClient.set(key, JSON.stringify(opts));
  },
  getGasInlineKeyboard: async (gasfee: GasFeeEnum) => {
    const keyboards = [
      { text: `${(gasfee === GasFeeEnum.LOW ? "🟢" : "🔴")} Low Gas`, command: 'low_gas' },
      { text: `${(gasfee === GasFeeEnum.MEDIUM ? "🟢" : "🔴")} Medium Gas`, command: 'medium_gas' },
      { text: `${(gasfee === GasFeeEnum.HIGH ? "🟢" : "🔴")} High Gas`, command: 'high_gas' },
    ];
    return keyboards;
  },
  getGasValue: (gasSetting: ITradeGasSetting) => {
    const { gas, value } = gasSetting;
    if (gas === GasFeeEnum.CUSTOM) return value ?? 0.005;

    if (gas === GasFeeEnum.LOW) {
      return 0.005; // SOL
    } else if (gas === GasFeeEnum.MEDIUM) {
      return 0.02; // SOL
    } else if (gas === GasFeeEnum.HIGH) {
      return 0.05; // SOL
    }
    return 0.005; // SOL
  },

  setGas: async (username: string, opts: ITradeGasSetting) => {
    const key = `${username}_gasfee`;
    await redisClient.set(key, JSON.stringify(opts));
  },
  getGas: async (username: string) => {
    const key = `${username}_gasfee`;
    const data = await redisClient.get(key);
    if (data) return JSON.parse(data) as ITradeGasSetting;
    return {
      gas: GasFeeEnum.LOW,
      value: 0.05
    } as ITradeGasSetting
  }
}
/** Gas Fee calculation */

/**
 * lamports_per_signature * number_of_signatures
 * 
 * ❯ solana fees
 * Blockhash: 7JgLCFReSYgWNpAB9EMCVv2H4Yv1UV79cp2oQQh2UtvF
 * Lamports per signature: 5000
 * Last valid block height: 141357699
 * 
 * You can get the fee's for a particular message (serialized transaction) by using the getFeeForMessage method.
 * 
 * getFeeForMessage(message: Message, commitment?: Commitment): Promise<RpcResponseAndContext<number>>
 * 
 * constants
 * 
 * pub const DEFAULT_TARGET_LAMPORTS_PER_SIGNATURE: u64 = 10_000;
 * pub const DEFAULT_TARGET_SIGNATURES_PER_SLOT: u64 = 50 * DEFAULT_MS_PER_SLOT; // 20_000
 * 
 * prioritizationFeeLamports = 1000_000
 * fee = 0.001
 * 
 * prioritizationFeeLamports = 25_000_000
 * fee = 0.025
 * 
 * prioritizationFeeLamports = 50_000_000
 * fee = 0.05
 */

