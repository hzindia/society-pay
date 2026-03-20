const nodemailer = require("nodemailer");
const config = require("../utils/config");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return transporter;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: config.payment.currency,
  }).format(amount);
}

/**
 * Send payment confirmation email
 */
async function sendPaymentConfirmation(payment, user) {
  if (!config.email.user || !config.email.pass) {
    console.warn("⚠️  Email not configured, skipping notification");
    return false;
  }

  const surchargeRow = payment.surchargeAmount > 0
    ? `<tr><td style="padding:8px 0;color:#666">Surcharge (${(payment.surchargeRate * 100).toFixed(1)}%)</td><td style="padding:8px 0;text-align:right;color:#dc2626">+ ${formatCurrency(payment.surchargeAmount)}</td></tr>`
    : "";

  const gstRow = payment.gstOnSurcharge > 0
    ? `<tr><td style="padding:8px 0;color:#666">GST on Surcharge</td><td style="padding:8px 0;text-align:right;color:#dc2626">+ ${formatCurrency(payment.gstOnSurcharge)}</td></tr>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff">
      <div style="background:#1a6b4a;padding:24px;text-align:center;color:#fff">
        <h1 style="margin:0;font-size:22px">${config.society.name}</h1>
        <p style="margin:4px 0 0;opacity:0.9;font-size:14px">Payment Receipt</p>
      </div>
      
      <div style="padding:24px">
        <p style="color:#333;font-size:16px">Dear ${user.name},</p>
        <p style="color:#666;font-size:14px">Your payment has been successfully processed. Here are the details:</p>
        
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;margin:16px 0">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666">Transaction ID</div>
          <div style="font-size:20px;font-weight:bold;color:#1f2937;font-family:monospace">${payment.transactionId}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#666">Flat No.</td><td style="padding:8px 0;text-align:right;font-weight:600">${user.wing ? user.wing + "-" : ""}${user.flatNumber}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Payment For</td><td style="padding:8px 0;text-align:right;font-weight:600">${payment.paymentType}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Payment Method</td><td style="padding:8px 0;text-align:right;font-weight:600">${payment.paymentMethod.replace("_", " ").toUpperCase()}</td></tr>
          <tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0;color:#666">Base Amount</td><td style="padding:8px 0;text-align:right">${formatCurrency(payment.baseAmount)}</td></tr>
          ${surchargeRow}
          ${gstRow}
          <tr style="border-top:2px solid #1a6b4a"><td style="padding:12px 0;font-weight:bold;font-size:16px;color:#1a6b4a">Total Paid</td><td style="padding:12px 0;text-align:right;font-weight:bold;font-size:18px;color:#1a6b4a">${formatCurrency(payment.totalAmount)}</td></tr>
        </table>

        <div style="text-align:center;margin:20px 0">
          <span style="background:#d1fae5;color:#065f46;padding:6px 20px;border-radius:20px;font-weight:bold;font-size:13px">✓ PAYMENT SUCCESSFUL</span>
        </div>

        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">
          This is an auto-generated receipt from ${config.society.shortName}.<br>
          For queries, contact: ${config.society.email || config.email.fromAddress}
          ${config.society.regNo ? `<br>Registration No: ${config.society.regNo}` : ""}
        </p>
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: `"${config.email.fromName}" <${config.email.fromAddress || config.email.user}>`,
      to: user.email,
      subject: `Payment Receipt - ${payment.transactionId} | ${config.society.shortName}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Email send failed:", err.message);
    return false;
  }
}

module.exports = { sendPaymentConfirmation };
