import axios from "axios";
import { GROWSOL_API_ENDPOINT } from "../config";

export enum ReferralPlatform {
  TradeBot,
  BridgeBot
}
export class ReferralChannelService {
  endpoint: string;
  constructor() {
    this.endpoint = GROWSOL_API_ENDPOINT;
  }

  async createReferralChannel(
    creator: string,
    referral_code: string
  ) {
    try {
      const url = `${this.endpoint}/referral/upsert_channel`;
      const data = {
        creator,
        referral_code,
        platform: ReferralPlatform.TradeBot
      }
      const result = await axios.post(url, data);
      return result.data;
    } catch (e) {
      return null;
    }
  }

  async addReferralChannel(data: any) {
    try {
      console.log("StartDouble 2");

      const url = `${this.endpoint}/referral/add_channel`;
      const result = await axios.post(url, data);
      return result.data;
    } catch (e) {
      return null;
    }
  }
  async updateReferralChannel(data: any) {
    try {
      const url = `${this.endpoint}/referral/upsert_channel`;
      const result = await axios.post(url, data);
      return result.data;
    } catch (e) {
      return null;
    }
  }
  async deleteReferralChannel(data: any) {
    try {
      const url = `${this.endpoint}/referral/delete_channel`;
      const result = await axios.post(url, data);
      return result.data;
    } catch (e) {
      console.log(e)
      return null;
    }
  }
  async getAllReferralChannels() {
    try {
      const url = `${this.endpoint}/referral/get_all_channels`;
      const result = await axios.get(url);
      return result.data;
    } catch (e) {
      return null;
    }
  }
}