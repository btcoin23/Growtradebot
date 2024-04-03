require("dotenv").config();
import startTradeBot from "./src/main";
import connectMongodb from "./src/services/mongodb";
import redisClient from "./src/services/redis";

// connect mongodb
connectMongodb()
  .then(() => {
    console.log('MongoDB connected');
    // redis
    connectRedis();
  })
  .catch(error => console.log("MongoDB connect failed", error));

// connect redis
const connectRedis = () => {
  redisClient.on('connect', function () {
    console.log('Redis database connected' + '\n');
    // start tradeBot
    startTradeBot();
  });

  redisClient.on('reconnecting', function () {
    console.log('Redis client reconnecting');
  });

  redisClient.on('ready', function () {
    console.log('Redis client is ready');
  });

  redisClient.on('error', function (err) {
    console.log('Something went wrong ' + err);
  });

  redisClient.on('end', function () {
    console.log('\nRedis client disconnected');
    console.log('Server is going down now...');
    process.exit();
  });

  redisClient.connect();
}
