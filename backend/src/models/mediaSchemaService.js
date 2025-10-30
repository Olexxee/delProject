import Media from "./mediaSchema.js";

// 🧩 Create media record
export const createMedia = async (data) => {
  const media = new Media(data);
  return await media.save();
};

// 📂 Get media by ID
export const getMediaById = async (id) => {
  return await Media.findById(id);
};

// 🧹 Delete media
export const deleteMedia = async (id) => {
  return await Media.findByIdAndDelete(id);
};

// 🗑️ Delete all expired media
export const cleanupExpiredMedia = async () => {
  const now = new Date();
  return await Media.deleteMany({ expiresAt: { $lte: now } });
};
