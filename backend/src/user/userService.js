import User from "./userSchema.js";

export const createUser = async (payload) => {
  const user = await User.create(payload);
  return user;
};

export const findUser = async (payload) => {
  return await User.findOne(payload);
};

export const findUserByEmail = async ({ email }) => {
  return User.findOne({ email });
};

export const findUserWithVerificationFields = async ({ email }) => {
  return User.findOne({ email }).select(
    "+verificationCode +verificationCodeExpiresAt"
  );
};

export const findAndUpdateUserById = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, {
    new: true,
  });
};

export const findUserByUsername = async ({ username }) => {
  const user = await User.findOne({ username });
  return user;
};

export const findUserById = async (id) => {
  return await User.findById(id);
};

export const findUserByIdAndUpdate = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, {
    new: true, // Return the updated document
  });
};


export const addGroupToUser = async ({ userId, groupId }) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      $addToSet: { groups: groupId },
      $inc: { groupsJoinedCount: 1 },
    },
    { new: true }
  );
};

export const updateUser = async (payload) => {
  return await User.findByIdAndUpdate(payload.id, payload, { new: true });
};

export const deleteUser = async (payload) => {
  return await User.findByIdAndDelete(payload.id);
};

export const updateUserByEmail = async (email, updateData) => {
  const updatedUser = await User.findOneAndUpdate({ email }, updateData, {
    new: true,
    runValidators: true,
  });

  return updatedUser;
};

export const timesFlaggedUser = async (payload) => {
  const user = await User.findById(payload.id);
  return await User.findByIdAndUpdate(
    payload.id,
    { $inc: { timesKicked: 1 } },
    { new: true }
  );
};
