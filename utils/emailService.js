import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER?.trim(),
    pass: process.env.EMAIL_PASSWORD?.trim(),
  },
});

const formatCAD = (est) => {
  if (!est) return 'Under Review';
  if (est.low && est.high) return est.low === est.high ? `$${est.low} CAD` : `$${est.low} - $${est.high} CAD`;
  return est.rangeFormatted ? `${est.rangeFormatted.replace(/৳/g, '$')}` : 'Under Review';
};

/**
 * Send email notifications to both Customer and Admin/Receiver
 */
export const sendQuoteNotifications = async (quote) => {
  const { reference, brand, model, condition, services, contact, turnaround, fulfillment, estimate, photos } = quote;
  const adminEmail = process.env.RECEIVER_EMAIL?.trim() || process.env.EMAIL_USER?.trim();
  const formattedEstimate = formatCAD(estimate);

  // 1. Customer Confirmation Email
  const customerMailOptions = {
    from: `"Sole Mission" <${process.env.EMAIL_USER?.trim()}>`,
    to: contact.email,
    subject: `Quote Received [${reference}] - Sole Mission`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #111; margin-bottom: 5px;">Sole Mission Restoration</h2>
        <p>Hi <strong>${contact.fullName}</strong>,</p>
        <p>Thank you for submitting your sneaker restoration quote. We have received your request!</p>
        <div style="background: #f7f7f7; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0 0 8px;"><strong>Quote Reference:</strong> <span style="color: #0066cc;">${reference}</span></p>
          <p style="margin: 0 0 8px;"><strong>Sneaker:</strong> ${brand} - ${model} (${condition})</p>
          <p style="margin: 0 0 8px;"><strong>Services:</strong> ${services?.join(', ')}</p>
          <p style="margin: 0 0 8px;"><strong>Estimated Price:</strong> ${formattedEstimate}</p>
          <p style="margin: 0;"><strong>Fulfillment:</strong> ${fulfillment === 'dropoff' ? 'Drop-off' : 'Mail-in'} (${turnaround} turnaround)</p>
        </div>
        <p>Our team is currently reviewing your photos. We will reach out to you via <strong>${contact.phone}</strong> or email shortly.</p>
        <p style="font-size: 13px; color: #777; margin-top: 25px;">Sole Mission • Premium Sneaker Care & Restoration</p>
      </div>
    `,
  };

  // 2. Admin Notification Email
  const photoList = Object.entries(photos || {})
    .filter(([_, p]) => p?.previewUrl)
    .map(([slot, p]) => `<li><strong>${slot}:</strong> <a href="${p.previewUrl}" target="_blank">View Photo</a></li>`)
    .join('');

  const adminMailOptions = {
    from: `"Sole Mission Alerts" <${process.env.EMAIL_USER?.trim()}>`,
    to: adminEmail,
    subject: `👟 New Quote [${reference}] - ${contact.fullName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #d9534f; margin-bottom: 5px;">New Quote Request: ${reference}</h2>
        <div style="background: #f7f7f7; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h4 style="margin: 0 0 10px;">Customer Details:</h4>
          <p style="margin: 0 0 5px;"><strong>Name:</strong> ${contact.fullName}</p>
          <p style="margin: 0 0 5px;"><strong>Phone:</strong> ${contact.phone}</p>
          <p style="margin: 0 0 5px;"><strong>Email:</strong> ${contact.email}</p>
          ${contact.instagram ? `<p style="margin: 0 0 5px;"><strong>Instagram:</strong> ${contact.instagram}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;" />
          <h4 style="margin: 0 0 10px;">Sneaker & Service:</h4>
          <p style="margin: 0 0 5px;"><strong>Pair:</strong> ${brand} - ${model} (Suede: ${quote.isSuede ? 'Yes' : 'No'})</p>
          <p style="margin: 0 0 5px;"><strong>Condition:</strong> ${condition}</p>
          <p style="margin: 0 0 5px;"><strong>Services:</strong> ${services?.join(', ')}</p>
          <p style="margin: 0 0 5px;"><strong>Estimate:</strong> ${formattedEstimate}</p>
          <p style="margin: 0;"><strong>Delivery:</strong> ${fulfillment} (${turnaround})</p>
        </div>
        ${photoList ? `<h4>Uploaded Photos:</h4><ul>${photoList}</ul>` : ''}
      </div>
    `,
  };

  // Send both emails simultaneously
  return await Promise.all([
    transporter.sendMail(customerMailOptions),
    transporter.sendMail(adminMailOptions),
  ]);
};

/**
 * Send cancellation email notification to Customer when quote is deleted/cancelled
 */
export const sendQuoteCancellationEmail = async (quote) => {
  const { reference, brand, model, contact } = quote;

  if (!contact?.email) return;

  const mailOptions = {
    from: `"Sole Mission" <${process.env.EMAIL_USER?.trim()}>`,
    to: contact.email,
    subject: `Quote Request Cancelled [${reference}] - Sole Mission`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #c9302c; margin-bottom: 5px;">Sole Mission Restoration</h2>
        <p>Hi <strong>${contact.fullName || 'Valued Customer'}</strong>,</p>
        <p>This is to inform you that your quote request for sneaker restoration has been <strong>cancelled</strong>.</p>
        <div style="background: #fdf7f7; border-left: 4px solid #d9534f; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <p style="margin: 0 0 8px;"><strong>Quote Reference:</strong> <span style="color: #0066cc;">${reference}</span></p>
          <p style="margin: 0;"><strong>Sneaker:</strong> ${brand || ''} ${model ? `- ${model}` : ''}</p>
        </div>
        <p>If you have any questions or feel this was done in error, please reach out to us or submit a new quote request anytime.</p>
        <p style="font-size: 13px; color: #777; margin-top: 25px;">Sole Mission • Premium Sneaker Care & Restoration</p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

/**
 * Send Password Reset OTP email notification
 */
export const sendPasswordResetOtpEmail = async ({ email, otp, name }) => {
  const mailOptions = {
    from: `"Sole Mission Security" <${process.env.EMAIL_USER?.trim()}>`,
    to: email,
    subject: `Your Password Reset Code [${otp}] - Sole Mission`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Sole Mission</h2>
          <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Security Verification</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 12px;">Hi <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 14px; color: #4b5563; margin: 0 0 20px;">
          We received a request to reset or update your password. Please use the verification code below to proceed:
        </p>

        <div style="background-color: #f9fafb; border: 2px dashed #111827; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #111827; font-family: 'Courier New', monospace;">
            ${otp}
          </div>
          <p style="font-size: 12px; color: #dc2626; font-weight: 600; margin: 10px 0 0;">
            ⏱ This code is valid for 10 minutes only
          </p>
        </div>

        <p style="font-size: 13px; color: #6b7280; margin: 20px 0 0;">
          If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>

        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0 16px;" />

        <div style="text-align: center;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            Sole Mission • Premium Sneaker Care & Restoration
          </p>
        </div>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

