import axios, { AxiosError, AxiosResponse, isAxiosError } from 'axios';
import { UserService } from './user.service';
import { schedule } from 'node-cron';
import referralHistory from '../models/referral.history';

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
        return ({ referral: false });
    }

    let referral_date = userInfo?.referral_date ?? new Date();
    let inputDate = new Date(referral_date);

    // Calculate the current date after 45 days
    let currentDateAfter45Days = inputDate.getTime() + (45 * 24 * 60 * 60 * 1000);

    // Calculate the current date after 90 days
    let currentDateAfter90Days = inputDate.getTime() + (90 * 24 * 60 * 60 * 1000);

    // Determine the referral_option based on the conditions
    let referral_option = 15;
    if (Date.now() < currentDateAfter45Days) {
        referral_option = 25;
    } else if (Date.now() < currentDateAfter90Days) {
        referral_option = 20;
    } else {
        referral_option = 15;
    }

    let referrerInfo = await UserService.findOne({ referrer_code: referral_code });

    return {
        referral: true,
        referral_option: referral_option,
        uniquecode: userInfo?.referral_code ?? "",
        referral_address: referrerInfo?.referrer_wallet == "" ? referrerInfo?.wallet_address : referrerInfo?.referrer_wallet
    };
}
export const get_referrer_info = async (username: string) => {
    let userInfo = await UserService.findOne({ username: username });

    return {
        uniquecode: userInfo?.referrer_code ?? "",
        schedule: userInfo?.schedule ?? "60"
    };
}

export const get_referral_num = async (uniquecode: string) => {
    let userList = await UserService.find({ referral_code: uniquecode });
    return { num: userList.length }
}

export const get_referral_amount = async (uniquecode: string) => {
    let referalList = await referralHistory.find({ uniquecode: uniquecode });
    let totalAmount = 0;
    for (let index = 0; index < referalList.length; index++) {
        totalAmount += referalList[index].amount;
    }
    return { totalAmount: totalAmount / 100000 / 10000 }
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