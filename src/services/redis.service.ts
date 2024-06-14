import redisClient from "./redis";

export const setFlagForBundleVerify = async (username: string) => {
  const key = `${username}_wait_bundle`;
  await redisClient.set(key, "true");
  await redisClient.expire(key, 30);
}
export const waitFlagForBundleVerify = async (username: string) => {
  const key = `${username}_wait_bundle`;
  const res = await redisClient.get(key);
  if (!res) return false;
  return true;
}