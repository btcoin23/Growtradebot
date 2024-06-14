export const BotMenu = [
  { command: 'start', description: 'Welcome' },
  { command: 'position', description: 'Positions' },
  { command: 'settings', description: 'Settings & Tools' },
];

export const BUY_XSOL_TEXT = `🌳Buy X SOL\n\n<i>💲 Enter SOL Value in format "0.05"</i>`;
export const PRESET_BUY_TEXT = `🌳Preset Buy SOL Button \n\n<i>💲 Enter SOL Value in format "0.0X"</i>`;
export const AUTO_BUY_TEXT = `🌳Auto Buy SOL Button \n\n<i>💲 Enter SOL Value in format "0.0X"</i>`;
export const SELL_XPRO_TEXT = `🌳Sell X %\n\n<i>💲 Enter X Value in format "25.5"</i>`;
export const WITHDRAW_XTOKEN_TEXT = `🌳Withdraw X token\n\n<i>💲 Enter X Value in format "25.5"</i>`;
export const SET_SLIPPAGE_TEXT = `🌳Slippage X %\n\n<i>💲 Enter X Value in format "2.5"</i>`;
export const TradeBotID = process.env.GROWTRADE_BOT_ID;
export const WELCOME_REFERRAL = 'https://imgtr.ee/images/2024/04/22/24635465dd390956e0fb39857a66bab5.png';
export const ALERT_GT_IMAGE = 'https://imgtr.ee/images/2024/04/22/a84bf0785b7eef4a64cde8c26b28686b.png';
export const ALERT_GB_IMAGE = 'https://imgtr.ee/images/2024/03/28/24ec15df80dad1223fcea15793278bbe.png';
export const AlertBotID = process.env.GROWSOL_ALERT_BOT_ID;
export const BridgeBotID = process.env.BridgeBotID;

export const INPUT_SOL_ADDRESS = 'Please send your SOL payout address in solana network.';
export const SET_GAS_FEE = `🌳 Custom GAS\n\n<i>💲 Enter SOL Value in format "0.001"</i>`;
export const SET_JITO_FEE = `🌳 Custom Fee Amount\n\n<i>💲 Enter SOL Value in format "0.001"</i>`;

export const WITHDRAW_TOKEN_AMT_TEXT = `<i>🌳 Enter your receive wallet address</i>`;
export enum CommandEnum {
  CLOSE = "dismiss_message",
  Dismiss = "dismiss_message",
  REFRESH = "refresh"
}
