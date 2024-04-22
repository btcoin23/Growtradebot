import TelegramBot from "node-telegram-bot-api";
import { copytoclipboard } from "../utils";
import { INPUT_SOL_ADDRESS } from "../bot.opts";
import { isValidWalletAddress } from "../utils";
import { OpenReferralWindowHandler } from "./referral.link.handler";
import { UserService } from "../services/user.service";

export const sendPayoutAddressManageScreen = async (
    bot: TelegramBot,
    chat: TelegramBot.Chat,
    message_id: number
) => {
    try {
        if (!chat.username) return;
        // fetch payout address list
        // const refdata = await get_referral_info(chat.username);
        // if (!refdata) {
        //     bot.sendMessage(chat.id, 'You have no referral code. Please create a referral code first.');
        //     return;
        // }

        // const { busdpayout, solpayout, uniquecode } = refdata;

        // const profitdata = await get_profits(uniquecode);
        const userInfo = await UserService.findOne({ username: chat.username });
        const payout_wallet = userInfo?.referrer_wallet ?? ""

        // `<b>Your profits</b> 💰\n` +
        //     // `Total profits: $${profitdata?.total_profit.toFixed(3) ?? "0"}\n` +
        //     // `Available profits: $${profitdata?.available_profit.toFixed(3) ?? "0"}` +
        //     `\n\n` +
        const caption = '<b>Payout address</b>👇\n' +
            `<b>SOL</b> wallet (Solana) 🔹\n${copytoclipboard(payout_wallet)}\n\n` +

            // `<b>USDT</b> wallet (BNB-chain) 🔸\n${copytoclipboard(busdpayout)}\n\n` +
            `Note: Payouts can be requests when profits reach a value of 20$.`

        const reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Update SOL address',
                    callback_data: JSON.stringify({
                        'command': 'set_sol_address'
                    })
                }],
                [{
                    text: 'Payout history',
                    callback_data: JSON.stringify({
                        'command': 'get_payout_history'
                    })
                }],
                [{
                    text: 'Refresh',
                    callback_data: JSON.stringify({
                        'command': 'refresh_payout'
                    })
                }, {
                    text: 'Back',
                    callback_data: JSON.stringify({
                        'command': 'back_from_ref'
                    })
                }],
            ],
        }
        await bot.editMessageCaption(
            caption,
            {
                chat_id: chat.id,
                message_id,
                parse_mode: 'HTML',
                reply_markup
            }
        );
    } catch (e) {
        console.log("sendPayoutAddressManageScreen Error", e);
    }

}


export const setSOLPayoutAddressHandler = async (
    bot: TelegramBot,
    chat: TelegramBot.Chat,
) => {
    try {
        if (!chat.username) return;
        const solAddressMsg = await bot.sendMessage(
            chat.id,
            INPUT_SOL_ADDRESS,
            {
                parse_mode: "HTML"
            }
        )
        const textEventHandler = async (msg: TelegramBot.Message) => {
            const receivedChatId = msg.chat.id;
            const receivedText = msg.text;
            const receivedMessageId = msg.message_id;
            const receivedTextSender = msg.chat.username;
            // Check if the received message ID matches the original message ID
            if (receivedText && receivedChatId === chat.id && receivedMessageId === solAddressMsg.message_id + 1) {
                // message should be same user
                if (receivedTextSender === chat.username) {
                    // update address
                    updateSOLaddressForPayout(bot, chat, solAddressMsg.message_id, receivedText);
                }
                bot.removeListener('text', textEventHandler);
            }
        }
        // Add the 'text' event listener
        bot.on('text', textEventHandler);
    } catch (e) {
        console.log("setSOLPayoutAddressHandler", e)
    }
}

const updateSOLaddressForPayout = async (bot: TelegramBot, chat: TelegramBot.Chat, old_message_id: number, address: string) => {
    try {
        const chatId = chat.id;
        // validate first
        if (!isValidWalletAddress(address)) {
            bot.deleteMessage(chatId, old_message_id);
            const message = await bot.sendMessage(
                chatId,
                'Invalid wallet address. Try it again'
            );
            setTimeout(() => {
                bot.deleteMessage(chatId, message.message_id);
            }, 3000);
            setSOLPayoutAddressHandler(bot, chat);
            return;
        }
        const username = chat.username;
        if (!username) return;
        // post
        const res = await UserService.findAndUpdateOne({ username: username }, {
            referrer_wallet: address
        });
        // const res = await update_payout_address(
        //     username,
        //     undefined,
        //     address,
        // )
        if (true) {
            const sentMsg = await bot.sendMessage(chatId, "Successfully updated!");
            setTimeout(() => {
                bot.deleteMessage(chatId, sentMsg.message_id);
                bot.deleteMessage(chatId, old_message_id + 1);
                bot.deleteMessage(chatId, old_message_id);
            }, 2000)
        }

    } catch (e) {
        console.log("updateSOLaddressForPayout", e)
    }
}

export const backToHomeHandler = async (
    bot: TelegramBot,
    chat: TelegramBot.Chat,
    msg: TelegramBot.Message
) => {
    if (!chat.username) return;
    bot.deleteMessage(chat.id, msg.message_id);
    OpenReferralWindowHandler(bot, msg);
}

export const refreshPayoutHandler = async (
    bot: TelegramBot,
    msg: TelegramBot.Message
) => {
    const chat = msg.chat;
    if (!chat.username) return;
    await sendPayoutAddressManageScreen(
        bot,
        chat,
        msg.message_id
    );
}