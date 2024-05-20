import referrerListModelSchema from "../models/referrer.list.model";

export const ReferrerListService = {
  create: async (props: any) => {
    try {
      return await referrerListModelSchema.create(props);
    } catch (err: any) {
      console.log(err);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await referrerListModelSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    const filter = props;
    try {
      const result = await referrerListModelSchema.findOne(filter).sort({ updatedAt: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
};
