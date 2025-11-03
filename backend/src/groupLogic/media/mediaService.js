import Media from "../../models/mediaSchema.js";
import * as firebaseService from "../../firebase/firebaseService.js";

const mediaService = {
  async create({
    ownerId,
    fileBuffer,
    fileName,
    type,
    usage,
    expiresInDays = null,
    metadata = {},
  }) {
    const uploadResult = await firebaseService.uploadFile(
      fileBuffer,
      fileName,
      type
    );

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const media = await Media.create({
      owner: ownerId,
      url: uploadResult.url,
      path: uploadResult.path,
      type,
      usage,
      expiresAt,
      metadata,
      size: uploadResult.size,
    });

    return media;
  },

  // ✅ Find media by ID
  async findById(id) {
    return await Media.findById(id);
  },

  // ✅ Delete media from Firebase and DB
  async deleteById(id) {
    const media = await Media.findById(id);
    if (!media) return false;

    await firebaseService.deleteFromFirebase(media.path);
    await media.deleteOne();
    return true;
  },

  // ✅ Clean up expired media automatically
  async cleanupExpired() {
    const expired = await Media.find({ expiresAt: { $lte: new Date() } });
    for (const media of expired) {
      await firebaseService.deleteFromFirebase(media.path);
      await media.deleteOne();
    }
    return expired.length;
  },
};

export default mediaService;
