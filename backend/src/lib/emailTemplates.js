import logger from "../lib/logger.js";
// emailTemplates.js

export const templates = {
  WELCOME_EMAIL: ({ firstName }) => ({
    subject: "Welcome to Jami 🎉 Your community abroad awaits!",
    body: `
      Hi ${firstName},
      Welcome to Jami – Where Africans Jam Abroad. 🎶
      
      You can now:
      • Connect with Africans in your city
      • Find events and RSVP easily
      • Buy, sell, or share pre-loved items
      • Support African-owned businesses
      
      👉 Start by completing your profile so others can find you!
    `,
  }),

  PROFILE_REMINDER: ({ firstName }) => ({
    subject: `People want to meet you, ${firstName} 👀`,
    body: `
      Hi ${firstName},
      Profiles with photos and interests get 3x more connections on Jami.
      
      Add yours today and start jamming with your community abroad.
    `,
  }),

  NEW_CONNECTION_REQUEST: ({ firstName, senderName }) => ({
    subject: `${senderName} wants to connect with you on Jami 🤝`,
    body: `
      Hi ${firstName},
      Good news! ${senderName} wants to connect with you on Jami.
      
      👉 Accept now and start chatting.
    `,
  }),

  CONNECTION_ACCEPTED: ({ firstName, senderName }) => ({
    subject: `You’re now connected with ${senderName} 🎉`,
    body: `
      Hi ${firstName},
      ${senderName} just accepted your connection request.
      
      Go ahead — start the conversation and see where it takes you!
    `,
  }),

  EVENT_REMINDER: ({ firstName, eventName, date, location }) => ({
    subject: "Your event is coming up soon 🎶",
    body: `
      Hi ${firstName},
      Just a reminder — ${eventName} is happening on ${date} at ${location}.
      
      You can also see who else RSVPed and connect before the event!
    `,
  }),

  NEW_EVENT: ({ firstName, city, eventName, date, venue }) => ({
    subject: `New event in ${city} — don’t miss out!`,
    body: `
      Hi ${firstName},
      Something’s happening in ${city}! 🎉
      
      ${eventName} – ${date} at ${venue}
      RSVP now and jam with your community.
    `,
  }),

  NEW_ITEM: ({ firstName, city, itemName, price }) => ({
    subject: "New item in Jami Mart near you 🛍",
    body: `
      Hi ${firstName},
      A new item has just been posted in ${city} Mart:
        • ${itemName} for £${price}
      
      👉 Message the seller directly before it’s gone.
    `,
  }),

  WEEKLY_DIGEST: ({ firstName, newEvents, newUsers, newMart }) => ({
    subject: "Your Jami Weekly Roundup 🌍",
    body: `
      Hi ${firstName},
      Here’s what’s new in your city this week:
        • ${newEvents} New events
        • ${newUsers} New people joined in your city
        • ${newMart} New Mart listings
      
      Stay connected, stay thriving.
    `,
  }),

  INACTIVE_USER: ({ firstName, newUsers, newEvents, newMart }) => ({
    subject: "We miss you on Jami 💛",
    body: `
      Hi ${firstName},
      Haven’t seen you around lately!
      
      Since you last logged in:
        • ${newUsers} New people joined your city
        • ${newEvents} New events posted
        • ${newMart} New Mart items listed
      
      Come back and see what’s new 👇
    `,
  }),

  PREMIUM_UPGRADE: ({ firstName }) => ({
    subject: "Unlock unlimited connections 💎",
    body: `
      Hi ${firstName},
      You’ve reached your daily limit of connection requests.
      
      Upgrade to Jami Premium for:
        • Unlimited requests
        • Special filters
        • Profile visitor insights
    `,
  }),
};

export const getEmailTemplate = (type, payload) => {
  const builder = templates[type];
  if (!builder) throw new Error(`No template for type ${type}`);
  return builder(payload);
};
