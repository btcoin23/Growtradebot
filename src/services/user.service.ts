import { UserSchema } from "../models/index";

export const UserService = {
  create: async (props: any) => {
    try {
      return await UserSchema.create(props);
    } catch (err: any) {
      console.log(err);
      throw new Error(err.message);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await UserSchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await UserSchema.findOne({ ...filter, retired: false });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await UserSchema.findOne(filter).sort({ updatedAt: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await UserSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findAndSort: async (props: any) => {
    const filter = props;
    try {
      const result = await UserSchema.find(filter).sort({ retired: 1, nonce: 1 })
        .exec();

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await UserSchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      const result = await UserSchema.findOneAndUpdate(filter, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateMany: async (filter: any, props: any) => {
    try {
      const result = await UserSchema.updateMany(filter, {
        $set: props
      });
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const result = await UserSchema.findOneAndDelete({ props });
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
