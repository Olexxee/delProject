import multer from "multer";
import path from "path";
import sharp from "sharp";
import mediaService from "../groupLogic/media/mediaService.js";
import firebaseService from "../firebase/firebaseService.js";

// Use memory storage to get file buffer directly
const storage = multer.memoryStorage();

// Allowable MIME types
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "audio/mpeg",
  "application/pdf",
];

// General upload configuration
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"), false);
    }
    cb(null, true);
  },
}).any(); // 👈 This allows any number of files from any field name

export const uploadMedia = upload;

/**
 * Process uploaded media (supports single or multiple)
 */
export const processMediaUpload = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return next();

    const folder = req.body.context || "general";

    // Process all uploaded files
    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const { buffer, mimetype, originalname } = file;
        const ext = path.extname(originalname).toLowerCase();

        let processedBuffer = buffer;
        if (mimetype.startsWith("image/")) {
          processedBuffer = await sharp(buffer)
            .resize({ width: 1000 })
            .jpeg({ quality: 80 })
            .toBuffer();
        }

        // Upload to Firebase
        const uploaded = await firebaseService.uploadFile(
          processedBuffer,
          originalname,
          folder,
          mimetype
        );

        // Save to MongoDB
        const mediaDoc = await mediaService.create({
          ownerId: req.user?._id || null,
          fileBuffer: processedBuffer,
          fileName: originalname,
          type: mimetype.startsWith("image/")
            ? "image"
            : mimetype.startsWith("video/")
            ? "video"
            : "file",
          usage: folder,
          metadata: { format: mimetype },
        });

        return {
          id: mediaDoc._id,
          url: uploaded.url,
          type: mimetype.startsWith("image/")
            ? "image"
            : mimetype.startsWith("video/")
            ? "video"
            : "file",
          size: uploaded.size,
        };
      })
    );

    // Attach uploaded media to the request
    req.media = uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles;

    next();
  } catch (error) {
    console.error("❌ Media upload error:", error);
    next(error);
  }
};
