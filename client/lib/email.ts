import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = process.env.FROM_EMAIL ?? 'BoxRetreat <noreply@boxretreat.com>';
const ADDRESS = process.env.LOCKER_ADDRESS ?? 'Playa Luquillo, PR 00773';
const DIRECTIONS =
  process.env.LOCKER_DIRECTIONS ??
  'From PR-3, take exit 31 toward Luquillo Beach. Lockers are at the main parking entrance.';

export async function sendConfirmationEmail(opts: {
  to: string;
  customerName: string;
  itemName: string;
  lockerNumber: number;
  accessCode: string;
  startDate: string;
  endDate: string;
  rentalId: string;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your BoxRetreat gear is ready — Locker #${opts.lockerNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h1>Hi ${opts.customerName} 👋</h1>
        <p>Your <strong>${opts.itemName}</strong> rental is confirmed!</p>
        <div style="background:#f4f4f4;border-radius:8px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px">Locker</p>
          <p style="margin:0;font-size:48px;font-weight:700">#${opts.lockerNumber}</p>
          <p style="margin:12px 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px">Access Code</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:#2563eb;letter-spacing:8px">${opts.accessCode}</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Gear</td><td><strong>${opts.itemName}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Pickup</td><td><strong>${opts.startDate}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Return by</td><td><strong>${opts.endDate} at 3:00 PM</strong></td></tr>
        </table>
        <h2>📍 Location</h2>
        <p>${ADDRESS}</p>
        <p style="color:#555">${DIRECTIONS}</p>
        <h2>🔄 Returning</h2>
        <p>Place gear back in the locker and submit return photos at:</p>
        <p><a href="${base}/gear/return/${opts.rentalId}">${base}/gear/return/${opts.rentalId}</a></p>
        <p style="color:#888;font-size:13px">Your $20 security deposit will be refunded within 48h after inspection.</p>
      </div>
    `,
  });
}

export async function sendReminderEmail(opts: {
  to: string;
  customerName: string;
  itemName: string;
  rentalId: string;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `⏰ Return your ${opts.itemName} by 3:00 PM today`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h1 style="color:#dc2626">⏰ Return Reminder</h1>
        <p>Hi ${opts.customerName},</p>
        <p>Your <strong>${opts.itemName}</strong> rental ends <strong>today at 3:00 PM</strong>.</p>
        <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:20px;margin:24px 0;text-align:center">
          <p style="margin:0;font-size:20px;font-weight:700;color:#dc2626">Return deadline: 3:00 PM today</p>
        </div>
        <p>Submit return photos at: <a href="${base}/gear/return/${opts.rentalId}">${base}/gear/return/${opts.rentalId}</a></p>
        <p>Need more time? <a href="${base}/gear/extend/${opts.rentalId}">Extend your rental →</a></p>
      </div>
    `,
  });
}

export async function sendExtensionPaymentEmail(opts: {
  to: string;
  customerName: string;
  itemName: string;
  extensionDays: number;
  totalCents: number;
  stripeUrl: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `BoxRetreat: Pay to extend your ${opts.itemName} rental`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h1>Rental Extension</h1>
        <p>Hi ${opts.customerName},</p>
        <p>Your extension request for <strong>${opts.itemName}</strong> (${opts.extensionDays} extra days) is ready.</p>
        <p><strong>Amount: $${(opts.totalCents / 100).toFixed(2)}</strong></p>
        <p style="margin-top:24px">
          <a href="${opts.stripeUrl}" style="background:#111;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;display:inline-block">
            Pay Now →
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:16px">Link expires in 24 hours.</p>
      </div>
    `,
  });
}
