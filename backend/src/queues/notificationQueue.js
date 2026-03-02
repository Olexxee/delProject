import { bullMQRedis } from "./bullmqRedis.js";

export const notificationQueue = new Queue("notificationQueue", {
  connection: bullMQRedis,
});
