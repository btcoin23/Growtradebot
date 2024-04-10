import { PositionSchema } from "../models/index";

export const PositionService = {
  create: async (props: any) => {
    try {
      return await PositionSchema.create(props);
    } catch (err: any) {
      console.log(err);
      throw new Error(err.message);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      const result = await PositionSchema.findById(id);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      const filter = props;
      const result = await PositionSchema.findOne({ ...filter });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const filter = props;
      const result = await PositionSchema.findOne(filter).sort({ updatedAt: -1 });

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    const filter = props;
    try {
      const result = await PositionSchema.find(filter);

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findAndSort: async (props: any) => {
    const filter = props;
    try {
      const result = await PositionSchema.find(filter).sort({ retired: 1, nonce: 1 })
        .exec();

      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id } = props;
    try {
      const result = await PositionSchema.findByIdAndUpdate(id, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      const result = await PositionSchema.findOneAndUpdate(filter, props);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const result = await PositionSchema.findOneAndDelete({ props });
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  },
  updateBuyPosition: async function (params: any) {
    const { wallet_address, mint, chat_id, username, volume } = params;

    let position = await PositionSchema.findOne({ wallet_address, mint });

    if (!position) {
      // Create new position entry if it doesn't exist
      position = new PositionSchema({ wallet_address, mint, chat_id, username, volume });
    } else {
      // Update volume if position already exists
      position.volume += volume;
    }
    await position.save();
  },
  updateSellPosition: async function (params: any) {
    const { wallet_address, mint, chat_id, username, percent } = params;

    const position = await this.findOne({ wallet_address, mint, chat_id, username });

    if (!position) {
      // No data found, return null
      return null;
    }
    if (percent >= 100) {
      position.volume = 0;
    } else {
      const sellVolume = position.volume * (percent / 100);
      position.volume = sellVolume;
    }

    await position.save();

    return position;
  }
};
