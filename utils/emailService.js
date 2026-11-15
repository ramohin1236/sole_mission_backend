import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
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

const photoSlotLabels = {
  front: 'Front Toe Box',
  outer: 'Outside',
  inner: 'Inside',
  heel: 'Heel / Back',
  outsole: 'Bottom',
};

/**
 * Extract photo details (label, url) from quote.photos
 * Supports both slot-based objects and arrays of photo objects / strings
 */
const extractPhotoList = (photos) => {
  if (!photos) return [];
  const rawPhotos = typeof photos?.toObject === 'function' ? photos.toObject() : photos;

  if (Array.isArray(rawPhotos)) {
    return rawPhotos
      .map((item, idx) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return { label: `Photo ${idx + 1}`, url: item };
        }
        const url = item.previewUrl || item.url || item.secure_url;
        const slotKey = (item.slot || '').toLowerCase();
        const label = photoSlotLabels[slotKey] || item.slot || item.fileName || `Photo ${idx + 1}`;
        return url ? { label, url } : null;
      })
      .filter(Boolean);
  }

  if (typeof rawPhotos === 'object') {
    return Object.entries(rawPhotos)
      .map(([slot, p]) => {
        if (!p) return null;
        const slotKey = slot.toLowerCase();
        const label = photoSlotLabels[slotKey] || (slot.charAt(0).toUpperCase() + slot.slice(1));
        if (typeof p === 'string') {
          return {
            label,
            url: p,
          };
        }
        const url = p.previewUrl || p.url || p.secure_url;
        return url ? { label, url, fileName: p.fileName } : null;
      })
      .filter(Boolean);
  }

  return [];
};

/**
 * Render uploaded Cloudinary photos as clickable links and thumbnails in email HTML
 */
const renderPhotosHtml = (photos) => {
  const photoItems = extractPhotoList(photos);
  if (!photoItems.length) return '';

  const thumbnailCards = photoItems
    .map(
      (item) => `
        <div style="display: inline-block; margin: 6px; text-align: center; vertical-align: top; width: 105px;">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
            <img src="${item.url}" alt="${item.label}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #d1d5db; display: block; margin: 0 auto 6px;" />
            <span style="font-size: 12px; font-weight: 600; color: #1f2937; display: block; text-transform: capitalize; margin-bottom: 2px;">${item.label}</span>
            <span style="font-size: 11px; color: #2563eb; text-decoration: underline; display: block;">View Photo ↗</span>
          </a>
        </div>
      `
    )
    .join('');

  return `
    <div style="margin: 18px 0; padding: 15px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;">
      <h4 style="margin: 0 0 12px; font-size: 14px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">
        Uploaded Sneaker Photos (${photoItems.length}):
      </h4>
      <div style="text-align: left;">
        ${thumbnailCards}
      </div>
    </div>
  `;
};

/**
 * Send email notifications to both Customer and Admin/Receiver
 */
export const sendQuoteNotifications = async (quote) => {
  const { reference, brand, model, condition, services, contact, turnaround, fulfillment, estimate, photos } = quote;
  const adminEmail = process.env.RECEIVER_EMAIL?.trim() || process.env.EMAIL_USER?.trim();
  const formattedEstimate = formatCAD(estimate);
  const photosHtml = renderPhotosHtml(photos);

  const isMailIn =
    typeof fulfillment === 'string' &&
    (fulfillment.toLowerCase() === 'mail' ||
     fulfillment.toLowerCase() === 'mail-in' ||
     fulfillment.toLowerCase().includes('mail'));

  const mailInInstructionsHtml = isMailIn
    ? `
        <div style="background: #f0f7ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
            <strong>Mailing your pair:</strong> please hold on to your shoes for now. Once we've reviewed your photos, we'll email you the shipping address and packing instructions. Your final price is confirmed when the pair is in hand, before any work starts.
          </p>
        </div>
      `
    : '';

  // 1. Customer Confirmation Email (No raw file attachments; Cloudinary URLs rendered in HTML body)
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
        ${photosHtml}
        ${mailInInstructionsHtml}
        <p>Our team is currently reviewing your photos. We will reach out to you via <strong>${contact.phone}</strong> or email shortly.</p>
        <p style="font-size: 13px; color: #777; margin-top: 25px;">Sole Mission • Premium Sneaker Care & Restoration</p>
      </div>
    `,
  };

  // 2. Admin Notification Email (No raw file attachments; Cloudinary URLs rendered in HTML body)
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
        ${photosHtml}
      </div>
    `,
  };

  // Explicitly ensure attachments array is never included to avoid provider file size limits
  delete customerMailOptions.attachments;
  delete adminMailOptions.attachments;

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

/**
 * Send Database JSON Backup email notification with attachment
 */
export const sendBackupEmail = async ({
  backupJsonString,
  filename,
  summary,
}) => {
  const adminEmail = process.env.RECEIVER_EMAIL?.trim() || process.env.EMAIL_USER?.trim();
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const actualFilename = filename || `solemission-mongodb-backup-${dateStr}.json`;
  const fileSizeKB = (Buffer.byteLength(backupJsonString, 'utf8') / 1024).toFixed(2);
  const formattedDate = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const mailOptions = {
    from: `"Sole Mission Database Backup" <${process.env.EMAIL_USER?.trim()}>`,
    to: adminEmail,
    subject: `🗄️ Sole Mission Database Backup - ${new Date().toISOString().split('T')[0]}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">Sole Mission Database Backup</h2>
          <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Automated MongoDB Backup System</p>
        </div>
        
        <p style="font-size: 15px; margin: 0 0 16px;">
          An automated backup of your MongoDB database has been successfully generated and is attached to this email as a JSON file.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
            Backup Summary:
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Generated At:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${formattedDate} (UTC)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Quotes Backed Up:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${summary?.quotesCount ?? 0}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Users Backed Up:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${summary?.usersCount ?? 0}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">File Name:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right; font-family: monospace;">${actualFilename}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">File Size:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600; text-align: right;">${fileSizeKB} KB</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #64748b; margin: 16px 0 0;">
          <strong>Security Notice:</strong> This backup contains database records. Please store this email and the attachment securely.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Sole Mission • Premium Sneaker Care & Restoration
        </p>
      </div>
    `,
    attachments: [
      {
        filename: actualFilename,
        content: backupJsonString,
        contentType: 'application/json',
      },
    ],
  };

  return await transporter.sendMail(mailOptions);
};


