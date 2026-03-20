/**
 * PDF Receipt Generator
 * 
 * Generates downloadable PDF receipts for payments.
 * Uses PDFKit for server-side PDF generation.
 * 
 * Install: npm install pdfkit
 */

const PDFDocument = require("pdfkit");
const config = require("../utils/config");

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: config.payment.currency,
  }).format(amount);
}

/**
 * Generate a PDF receipt buffer for a payment
 * @param {Object} payment - Payment record with user relation
 * @returns {Promise<Buffer>} PDF as buffer
 */
function generateReceipt(payment) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Receipt - ${payment.transactionId}`,
          Author: config.society.name,
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const user = payment.user;
      const pageWidth = doc.page.width - 100; // margins

      // ── Header ──────────────────────────────────────────────────────
      doc.rect(50, 50, pageWidth, 80).fill("#1a6b4a");

      doc.fontSize(22).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text(config.society.name, 70, 68, { width: pageWidth - 40 });

      doc.fontSize(10).fillColor("#d1fae5").font("Helvetica");
      doc.text("Official Payment Receipt", 70, 95, { width: pageWidth - 40 });

      // ── Society Details ─────────────────────────────────────────────
      let y = 150;
      doc.fillColor("#6b7280").fontSize(9).font("Helvetica");
      if (config.society.address) {
        doc.text(config.society.address, 50, y);
        y += 14;
      }
      const contactParts = [];
      if (config.society.email) contactParts.push(`Email: ${config.society.email}`);
      if (config.society.phone) contactParts.push(`Phone: ${config.society.phone}`);
      if (contactParts.length) {
        doc.text(contactParts.join("  |  "), 50, y);
        y += 14;
      }
      if (config.society.regNo) {
        doc.text(`Registration No: ${config.society.regNo}`, 50, y);
        y += 14;
      }

      // ── Transaction ID Box ──────────────────────────────────────────
      y += 10;
      doc.roundedRect(50, y, pageWidth, 50, 5).fill("#f0fdf4").stroke("#bbf7d0");

      doc.fillColor("#6b7280").fontSize(8).font("Helvetica");
      doc.text("TRANSACTION ID", 0, y + 10, { width: doc.page.width, align: "center" });

      doc.fillColor("#1f2937").fontSize(16).font("Helvetica-Bold");
      doc.text(payment.transactionId, 0, y + 24, { width: doc.page.width, align: "center" });

      // ── Payment Details Table ───────────────────────────────────────
      y += 75;

      const rows = [
        ["Date & Time", payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN")],
        ["Flat No.", `${user.wing ? user.wing + "-" : ""}${user.flatNumber}`],
        ["Member Name", user.name],
        ["Email", user.email],
        ["Payment For", payment.paymentType],
        ["Payment Method", payment.paymentMethod.replace(/_/g, " ").toUpperCase()],
        ["", ""], // separator
        ["Base Amount", formatCurrency(payment.baseAmount)],
      ];

      if (payment.surchargeAmount > 0) {
        rows.push([
          `Surcharge (${(payment.surchargeRate * 100).toFixed(1)}%)`,
          `+ ${formatCurrency(payment.surchargeAmount)}`,
        ]);
      }

      if (payment.gstOnSurcharge > 0) {
        rows.push([
          `GST on Surcharge (${config.gst.rate}%)`,
          `+ ${formatCurrency(payment.gstOnSurcharge)}`,
        ]);
      }

      // Draw table rows
      for (const [label, value] of rows) {
        if (!label && !value) {
          // Separator
          doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
          y += 10;
          continue;
        }

        // Alternate row background
        doc.fillColor("#374151").fontSize(10).font("Helvetica");
        doc.text(label, 60, y, { width: 200 });

        doc.font("Helvetica-Bold");
        doc.text(value, 280, y, { width: pageWidth - 240, align: "right" });

        y += 22;
      }

      // ── Total Box ──────────────────────────────────────────────────
      y += 5;
      doc.rect(50, y, pageWidth, 45).fill("#1a6b4a");

      doc.fillColor("#ffffff").fontSize(12).font("Helvetica-Bold");
      doc.text("Total Paid", 70, y + 14);

      doc.fontSize(18).font("Helvetica-Bold");
      doc.text(formatCurrency(payment.totalAmount), 280, y + 11, {
        width: pageWidth - 250,
        align: "right",
      });

      // ── Status Badge ───────────────────────────────────────────────
      y += 60;
      const statusText = `✓ ${payment.status}`;
      doc.roundedRect(200, y, 110, 26, 13).fill("#d1fae5");
      doc.fillColor("#065f46").fontSize(11).font("Helvetica-Bold");
      doc.text(statusText, 200, y + 7, { width: 110, align: "center" });

      // ── Razorpay Reference ─────────────────────────────────────────
      if (payment.razorpayPaymentId) {
        y += 40;
        doc.fillColor("#9ca3af").fontSize(8).font("Helvetica");
        doc.text(`Razorpay Payment ID: ${payment.razorpayPaymentId}`, 50, y, {
          width: pageWidth,
          align: "center",
        });
      }

      // ── GST Details ────────────────────────────────────────────────
      if (config.gst.enabled && config.gst.gstin) {
        y += 16;
        doc.fillColor("#9ca3af").fontSize(8).font("Helvetica");
        doc.text(`GSTIN: ${config.gst.gstin}`, 50, y, { width: pageWidth, align: "center" });
      }

      // ── Footer ─────────────────────────────────────────────────────
      y = doc.page.height - 80;
      doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();

      y += 10;
      doc.fillColor("#9ca3af").fontSize(8).font("Helvetica");
      doc.text(
        "This is a computer-generated receipt. No signature is required.",
        50, y, { width: pageWidth, align: "center" }
      );
      doc.text(
        `Generated by SocietyPay for ${config.society.shortName}`,
        50, y + 14, { width: pageWidth, align: "center" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceipt };
