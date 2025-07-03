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
