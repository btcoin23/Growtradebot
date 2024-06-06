import { timeStamp } from "console";
import { TokenSchema } from "../models/index";

export const RaydiumTokenService = {
  create: async (props: any) => {
    try {
      // return await TokenSchema.create(props);
      const existing = await TokenSchema.findOne({ poolId: props.poolId });
      if (existing == null) {
        console.log(props)
        return await TokenSchema.create(props);
      } else {
        return;
      }
    } catch (err: any) {
      console.log(err);
      // throw new Error(err.message);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await TokenSchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await TokenSchema.findOne(filter).sort({ timeStamp: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await TokenSchema.findOne(filter).sort({ updatedAt: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await TokenSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await TokenSchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOneAndUpdate: async (props: any) => {
    const { filter, data } = props;
    try {
      const result = await TokenSchema.findOneAndUpdate(
        filter,
        { $set: data },
        { new: true }
      );
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const result = await TokenSchema.findOneAndDelete({ props });
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  }
};
