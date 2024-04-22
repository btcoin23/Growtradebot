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