import redisClient from "./redis";

export enum GasFeeEnum {
  LOW = 'low',
  HIGH = 'high',
  MEDIUM = 'medium',
}

export const GasFeeService = {
  getGasSetting: async (username: string) => {
    const key = `gas_${username}`;
    const data = await redisClient.get(key);
    if (data) return data as GasFeeEnum;
    return GasFeeEnum.MEDIUM;
  },
  setGasSetting: async (username: string, opts: GasFeeEnum) => {
    const key = `gas_${username}`;
    await redisClient.set(key, opts);
  },
  getSlippageSetting: async (username: string,) => {
    const key = `slippage_${username}`;
    const data = await redisClient.get(key);
    if (data) return parseFloat(data);
    return 5;
  },
  setSlippageSetting: async (username: string, slippage: number) => {
    const key = `slippage_${username}`;
    await redisClient.set(key, slippage);
  },
  getGasInlineKeyboard: async (username: string, gasfee?: GasFeeEnum) => {
    const gasopts = gasfee ? gasfee : await GasFeeService.getGasSetting(username);
    const keyboards = [
      { text: `${(gasopts === GasFeeEnum.LOW ? "🟢" : "🔴")} Low Gas`, command: 'low_gas' },
      { text: `${(gasopts === GasFeeEnum.MEDIUM ? "🟢" : "🔴")} Medium Gas`, command: 'medium_gas' },
      { text: `${(gasopts === GasFeeEnum.HIGH ? "🟢" : "🔴")} High Gas`, command: 'high_gas' },
    ];
    return keyboards;
  },
  getGasValue: async (username: string, gasfee?: GasFeeEnum) => {
    const gasopts = gasfee ? gasfee : await GasFeeService.getGasSetting(username);

    if (gasopts === GasFeeEnum.LOW) {
      // Micro Lamports: 460085
      return `Gas: 0.000105 SOL`;
    } else if (gasopts === GasFeeEnum.MEDIUM) {
      // Micro Lamports: 702044
      return `Gas: 0.000139 SOL`;
    } else if (gasopts === GasFeeEnum.HIGH) {
      // Micro Lamports -1582762
      return `Gas: 0.000305 SOL`;
    }
    return `Gas: 0.000105 SOL`;
  }
}