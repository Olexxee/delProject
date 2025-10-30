import { firebaseStorage } from "./firebaseAdminService.js";
import { v4 as uuidv4 } from "uuid";

class FirebaseService {
  async uploadFile(buffer, filename, folder = "uploads", mimetype) {
    const uniqueName = `${folder}/${uuidv4()}-${filename}`;
    const file = firebaseStorage.file(uniqueName);

    await file.save(buffer, {
      metadata: { contentType: mimetype },
      public: true,
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    const [metadata] = await file.getMetadata();

    return {
      name: uniqueName,
      url,
      size: metadata.size,
      contentType: metadata.contentType,
    };
  }

  async deleteFile(filePath) {
    try {
      await firebaseStorage.file(filePath).delete();
      return { success: true };
    } catch (error) {
      console.error("❌ Firebase delete error:", error.message);
      throw new Error("Failed to delete file from Firebase");
    }
  }

  async getFileMetadata(filePath) {
    try {
      const [metadata] = await firebaseStorage.file(filePath).getMetadata();
      return metadata;
    } catch (error) {
      throw new Error("Could not fetch metadata");
    }
  }
}

const firebaseService = new FirebaseService();
export default firebaseService;
