// AWS SES Setup - For Western Markets
// helpers/email.js
// server/helpers/email.js
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const client = new SESClient({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
});

export const sendWelcomeEmail = async (email) => {
  const params = {
    Source: process.env.EMAIL_FROM,
    ReplyToAddresses: [process.env.EMAIL_TO],
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
                        <html>
                            <p>Good day! Welcome to ${process.env.APP_NAME} and thank you for join us.</p>
                            <div style="margin:20process.env.APP_NAME px auto;">
                                <a href="${process.env.CLIENT_URL}" style="margin-right:50px">Browse properties</a>
                                <a href="${process.env.CLIENT_URL}/post-ad">Post ad</a>
                            </div>
                            <i>Team ${process.env.APP_NAME}</i>
                        </html>
                    `,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Welcome to ${process.env.APP_NAME}`,
      },
    },
  };
  const command = new SendEmailCommand(params);
  try {
    const data = await client.send(command);
    return data;
  } catch (err) {
    throw err;
  }
};

export const sendPasswordResetEmail = async (email, code) => {
  const params = {
    Source: process.env.EMAIL_FROM,
    ReplyToAddresses: [process.env.EMAIL_TO],
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
            <html>
            <p>Good day! Here is your password reset code</p>
            <h2 style="color:red;">${code}</h2>
            <i>- Team ${process.env.APP_NAME}</i>
            </html>
            `,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Password reset code - ${process.env.APP_NAME}`,
      },
    },
  };
  const command = new SendEmailCommand(params);
  try {
    const data = await client.send(command);
    return data;
  } catch (error) {
    throw error;
  }
};

export const sendContactEmailToAgent = async ({
  ad,
  user,
  message,
  clientUrl,
}) => {
  // Validate required parameters
  if (!ad || !user || !message) {
    throw new Error(
      `Missing required parameters: ${!ad ? "ad " : ""}${!user ? "user " : ""}${
        !message ? "message" : ""
      }`
    );
  }

  // Verify required email fields
  if (!ad.postedBy?.email || !user.email) {
    throw new Error(
      `Missing email addresses: ${!ad.postedBy?.email ? "Agent email " : ""}${
        !user.email ? "User email" : ""
      }`
    );
  }

  // Prepare email content with fallbacks
  const emailHtml = `
    <html>
      <p>Good day! ${ad.postedBy.name || "Agent"}</p>
      <p>You have received a new enquiry from ${user.name || "a user"} 
      from <a href="${clientUrl}">${clientUrl}</a></p>

      <p><strong>Details:</strong></p>
      <ul>
        <li>Name: ${user.name || "Not provided"}</li>
        <li>Email: <a href="mailto:${user.email}">${user.email}</a></li>
        <li>Phone: ${user.phone || "Not provided"}</li>
        <li>Enquired ad: 
          <a href="${clientUrl}/ad/${ad.slug}">
            ${ad.propertyType || "Property"} for ${ad.action || "Rent/Sell"} - 
            ${ad.address || ""} (${ad.price || ""})
          </a>
        </li>
      </ul>

      <p><strong>Message:</strong></p>
      <p>${message}</p>
      
      <p>Thank you!</p>
      <i>Team ${process.env.APP_NAME || "Real Estate"}</i>
    </html>
  `;

  const params = {
    Source: process.env.EMAIL_FROM,
    ReplyToAddresses: [user.email],
    Destination: {
      ToAddresses: [ad.postedBy.email],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: emailHtml,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `New enquiry about your ${ad.propertyType || "property"} listing`,
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const data = await client.send(command);
    console.log("Email sent successfully:", data.MessageId);
    return data;
  } catch (err) {
    console.error("AWS SES Error:", {
      code: err.code,
      message: err.message,
      stack: err.stack,
    });
    throw new Error(`Failed to send email: ${err.message}`);
  }
};
