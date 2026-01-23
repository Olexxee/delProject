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

  OTP_EMAIL: ({ firstName, code }) => ({
    from: process.env.RESEND_FROM_EMAIL || 'JAMI <support@support.myjami.app>',
    subject: `Your JAMI verification code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 JAMI</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0;">Your Community Abroad</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #333333; margin: 0 0 20px 0;">Hi ${firstName}! 👋</h2>
              <p style="color: #666666; margin: 0 0 30px 0; font-size: 16px;">
                Use this code to verify your email:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="background-color: #f8f9fa; border-radius: 8px; padding: 30px;">
                    <div style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: monospace;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>
              <p style="color: #666666; margin: 20px 0; font-size: 14px;">
                ⏰ This code expires in <strong>10 minutes</strong>.
              </p>
              <p style="color: #666666; margin: 20px 0; font-size: 14px;">
                🔒 Never share this code with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center;">
              <p style="color: #999999; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} JAMI Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  text: `Hi ${firstName}! Your JAMI verification code is: ${code}. This code expires in 10 minutes.`
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
