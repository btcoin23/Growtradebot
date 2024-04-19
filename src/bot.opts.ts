export const BotMenu = [
  { command: 'start', description: 'Welcome' },
  { command: 'position', description: 'Positions' },
];

export const BUY_XSOL_TEXT = `🌳Buy X SOL\n\n<i>💲 Enter SOL Value in format "0.05"</i>`;
export const PRESET_BUY_TEXT = `🌳Preset Buy SOL Button \n\n<i>💲 Enter SOL Value in format "0.0X"</i>`;
export const SELL_XPRO_TEXT = `🌳Sell X %\n\n<i>💲 Enter X Value in format "25.5"</i>`;
export const WITHDRAW_XTOKEN_TEXT = `🌳Withdraw X token\n\n<i>💲 Enter X Value in format "25.5"</i>`;
export const SET_SLIPPAGE_TEXT = `🌳Slippage X %\n\n<i>💲 Enter X Value in format "2.5"</i>`;
export const SET_GAS_FEE = `🌳 Custom GAS\n\n<i>💲 Enter SOL Value in format "0.001"</i>`;

export const WITHDRAW_TOKEN_AMT_TEXT = `<i>🌳 Enter your receive wallet address</i>`;
export enum CommandEnum {
  CLOSE = "dismiss_message",
  Dismiss = "dismiss_message",
  REFRESH = "refresh"
}
