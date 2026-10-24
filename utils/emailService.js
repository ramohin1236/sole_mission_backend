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
