import logger from "../../lib/logger.js";
import transport from "../../lib/classes/nodeMailerClass.js";
import configService from "../../lib/classes/configClass.js";
import { getEmailTemplate } from "../../lib/emailTemplates.js";
import { randomUUID } from "crypto";

/**
 * Email channel abstraction using Nodemailer.
 * Supports plain text, HTML, attachments, and inline images.
 */
export const emailChannel = {
  send: async ({
    to,
    type,
    payload,
    attachments = [],
    inlineImages = [],
    meta = {},
  }) => {
    if (!to) {
      throw new Error("Email channel: missing recipient address");
    }

    try {
      const { subject, body } = getEmailTemplate(type, payload);

      // Normalize inline images: ensure each has a CID
      const normalizedInlineImages = inlineImages.map((img) => ({
        ...img,
        cid: img.cid || `${randomUUID()}@jami.local`,
      }));

      const mailOptions = {
        from: configService.getOrThrow("EMAIL"),
        to,
        subject,
        text: body, // plain text fallback
        html: buildHtmlTemplate(subject, body, normalizedInlineImages),
        headers: {
          "X-Custom-Meta": JSON.stringify(meta),
        },
        attachments: [
          // normal file attachments
          ...attachments.map((att) => ({
            filename: att.filename,
            path: att.path,
            content: att.content,
            contentType: att.contentType || undefined,
          })),
          // inline images with ensured CID
          ...normalizedInlineImages.map((img) => ({
            filename: img.filename,
            path: img.path,
            cid: img.cid,
          })),
        ],
      };

      const result = await transport.sendMail(mailOptions);

      console.log("Email sent:", result.messageId);

      return { success: true, id: result.messageId };
    } catch (error) {
      console.log("Email channel error:", error);
      throw error;
    }
  },
};

/**
 * Wrap email body into a simple branded HTML template.
 * Inline images are automatically inserted if provided.
 */
function buildHtmlTemplate(subject, body, inlineImages = []) {
  const inlineImgTags = inlineImages
    .map(
      (img) =>
        `<img src="cid:${img.cid}" alt="${img.filename}" style="max-width:100%; margin-top:15px;"/>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f9f9f9;
            color: #333;
            padding: 20px;
          }
          .container {
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            margin: auto;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          }
          h1 {
            color: #4CAF50;
            font-size: 20px;
          }
          p {
            line-height: 1.6;
          }
          .footer {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${subject}</h1>
          <p>${body.replace(/\n/g, "<br/>")}</p>
          ${inlineImgTags}
          <div class="footer">
            You’re receiving this email because you’re part of the Jami community.
          </div>
        </div>
      </body>
    </html>
  `;
}
