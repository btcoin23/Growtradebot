import { ReferralSchema } from "../models";

export const ReferralController = {
  create: async (
    username: string,
    first_name: string,
    last_name: string,
    chat_id: number,
    referral_code: string
  ) => {
    try {
      const data = {
        username,
        first_name,
        last_name,
        chat_id: chat_id.toFixed(0),
        referral_code
      };
      const filter = {
        username
      };
      // Define options for findOneAndUpdate
      const options = {
        upsert: true, // Create a new document if no document matches the filter
        new: true, // Return the modified document rather than the original
        setDefaultsOnInsert: true // Apply the default values specified in the model schema
      };
      await ReferralSchema.findOneAndUpdate(filter, data, options);
    } catch (err: any) {
      console.log(err);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await ReferralSchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await ReferralSchema.findOne(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await ReferralSchema.findOne(filter).sort({ updatedAt: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await ReferralSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await ReferralSchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  extractUniqueCode: (text: string): string | null => {
    const words = text.split(' ');
    return words.length > 1 ? words[1] : null;
  }

};
