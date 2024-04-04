import redisClient, { IUserTradeSetting } from "./redis";

export enum GasFeeEnum {
  LOW = 'low',
  HIGH = 'high',
  MEDIUM = 'medium',
}

export const UserTradeSettingService = {
  get: async (username: string, mint: string) => {
    const key = `${username}_${mint}`;
    const data = await redisClient.get(key);
    if (data) return JSON.parse(data) as IUserTradeSetting;
    return {
      slippage: 20,
      slippagebps: 2000,
      gas: GasFeeEnum.MEDIUM
    } as IUserTradeSetting
  },
  set: async (username: string, mint: string, opts: IUserTradeSetting) => {
    const key = `${username}_${mint}`;
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
  getGasValue: async (gasfee: GasFeeEnum) => {
    if (gasfee === GasFeeEnum.LOW) {
      // Micro Lamports: 460085 auto
      return `Gas: 0.000105 SOL`;
    } else if (gasfee === GasFeeEnum.MEDIUM) {
      // Micro Lamports: 702044 2 multiplier
      return `Gas: 0.000139 SOL`;
    } else if (gasfee === GasFeeEnum.HIGH) {
      // Micro Lamports -1582762 . multiplier
      return `Gas: 0.000305 SOL`;
    }
    return `Gas: 0.000105 SOL`;
  }
}