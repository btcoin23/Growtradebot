import axios, { AxiosError, AxiosResponse, isAxiosError } from 'axios';
import { UserService } from './user.service';
import { schedule } from 'node-cron';

export type ReferralData = {
    username: string,
    uniquecode: string,
    busdpayout: string,
    solpayout: string,
    schedule: number,
}

export type ReferralProfits = {
    total_profit: number,
    available_profit: number,
    total_txns: number
}

export const get_referral_info = async (username: string) => {
    let userInfo = await UserService.findOne({ username: username });
    let referral_code = userInfo?.referral_code;

    if (referral_code == '') {
        return;
    }

    let referral_date = userInfo?.referral_date ?? new Date();
    let inputDate = new Date(referral_date);

    // Calculate the current date after 45 days
    let currentDateAfter45Days = inputDate.getTime() + (45 * 24 * 60 * 60 * 1000);

    // Calculate the current date after 90 days
    let currentDateAfter90Days = inputDate.getTime() + (90 * 24 * 60 * 60 * 1000);

    // Determine the referral_option based on the conditions
    let referral_option = 0;
    console.log("🚀 ~ constget_referral_info= ~ referral_option:", referral_option)
    if (Date.now() < currentDateAfter45Days) {
        referral_option = 0;
    } else if (Date.now() < currentDateAfter90Days) {
        referral_option = 1;
    } else {
        referral_option = 2;
    }

    let referrerInfo = await UserService.findOne({ referrer_code: referral_code });

    return {
        referral_option: referral_option,
        uniquecode: userInfo?.referral_code ?? "",
        referral_address: referrerInfo?.referrer_wallet ?? referrerInfo?.wallet_address
    };
}
export const get_referrer_info = async (username: string) => {
    let userInfo = await UserService.findOne({ username: username });

    return {
        uniquecode: userInfo?.referrer_code ?? "",
        schedule: userInfo?.schedule ?? "60"
    };
}

export const getReferralList = async () => {
    let userInfo = await UserService.find({});
    let res = userInfo?.map((item) => ({
        username: item.username,
        uniquecode: item.referrer_code,
        schedule: item.schedule ?? "60"
    }))
    return res;
}

export const update_channel_id = async (username: string, idx: number, channelId: string) => {
    try {
        const refdata = {
            username,
            arrayIdx: idx,
            channelId
        }
        return null;
    } catch (error) {
        return null;
    }
}