import mongoose from 'mongoose';
import { MONGODB_URL } from '../config';

const connectOptions: mongoose.ConnectOptions = {
  autoCreate: true,
  retryReads: true,
};
const connectMongodb = () => {
  return mongoose.connect(MONGODB_URL, connectOptions);
}
export default connectMongodb;
