import { ReferralChannelSchema } from "../models";

export const ReferralChannelController = {
  create: async (
    creator: string,
    channel_name: string,
    chat_id: string,
    referral_code: string
  ) => {
    try {
      const data = {
        channel_name,
        creator,
        chat_id: chat_id,
        referral_code,
      };
      const filter = {
        chat_id,
      };
      // Define options for findOneAndUpdate
      const options = {
        upsert: true, // Create a new document if no document matches the filter
        new: true, // Return the modified document rather than the original
        setDefaultsOnInsert: true, // Apply the default values specified in the model schema
      };
      await ReferralChannelSchema.findOneAndUpdate(filter, data, options);
    } catch (err: any) {
      console.log(err);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await ReferralChannelSchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await ReferralChannelSchema.findOne(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await ReferralChannelSchema.findOne(filter).sort({
        updatedAt: -1,
      });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await ReferralChannelSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await ReferralChannelSchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const result = await ReferralChannelSchema.findOneAndDelete({ props });
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
