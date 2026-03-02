import { Worker } from "bullmq";
import { NotificationService } from "../../logic/notifications/notificationService.js";
import userService from "../../user/userService.js";
import groupService from "../groupLogic/groupService.js";
import { bullMQRedis } from "../../queues/bullmqRedis.js";

const handleGroupCreated = async ({ userId, groupId }) => {
  const [user, group] = await Promise.all([
    userService.findUserById(userId),
    groupService.findById(groupId),
  ]);

  if (!user || !group) return;

  await NotificationService.send({
    recipientId: user._id,
    sender: "system",
    type: "GROUP_CREATED",
    title: `Group "${group.name}" created 🎉`,
    message: `You are now the admin of "${group.name}".`,
    channels: ["inApp", "email"],
  });
};

const jobHandlers = {
  GROUP_CREATED: handleGroupCreated,
};

new Worker(
  "notificationQueue",
  async (job) => {
    const handler = jobHandlers[job.name];
    if (!handler) return;
    await handler(job.data);
  },
  { connection: bullMQRedis },
);
