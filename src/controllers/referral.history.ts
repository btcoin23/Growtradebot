import { ReferralHistorySchema } from "../models";

export const ReferralHistoryControler = {
  create: async (props: any) => {
    try {
      return await ReferralHistorySchema.create(props);
    } catch (err: any) {
      console.log(err);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await ReferralHistorySchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await ReferralHistorySchema.findOne(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await ReferralHistorySchema.findOne(filter).sort({
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
      const result = await ReferralHistorySchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await ReferralHistorySchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const result = await ReferralHistorySchema.findOneAndDelete({ props });
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
