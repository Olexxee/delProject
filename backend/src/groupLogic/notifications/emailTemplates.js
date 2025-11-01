import logger from "../../lib/logger.js";
export const welcomeEmailTemplate = (firstName, profileLink) => ({
  subject: `Welcome to Jami 🎉 Your community abroad awaits!`,
  html: `
    <p>Hi ${firstName},</p>
    <p>Welcome to Jami – Where Africans Jam Abroad. 🎶</p>
    <p>You can now:</p>
    <ul>
      <li>Connect with Africans in your city</li>
      <li>Find events and RSVP easily</li>
      <li>Buy, sell, or share pre-loved items</li>
      <li>Support African-owned businesses</li>
    </ul>
    <p>👉 <a href="${profileLink}">Complete My Profile</a></p>
  `,
});
  