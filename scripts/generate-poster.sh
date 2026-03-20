#!/bin/bash
# ============================================================================
#  SocietyPay — Generate Notice Board Poster with QR Code
#
#  Creates an HTML poster with QR code that you can print and put on the
#  society notice board, or share as an image in WhatsApp groups.
#
#  Usage:
#    ./scripts/generate-poster.sh https://pay.greenvalley.in
#    ./scripts/generate-poster.sh https://bit.ly/gv-pay
#
#  Output: poster.html (open in browser and print)
# ============================================================================

set -e

URL="${1:-http://localhost:3000}"

# Read society name from .env if available
SOCIETY_NAME="Your Housing Society"
if [ -f .env ]; then
    NAME=$(grep '^SOCIETY_NAME=' .env | cut -d'"' -f2)
    if [ -n "$NAME" ]; then
        SOCIETY_NAME="$NAME"
    fi
fi

SHORT_NAME="$SOCIETY_NAME"
if [ -f .env ]; then
    SN=$(grep '^SOCIETY_SHORT_NAME=' .env | cut -d'"' -f2)
    if [ -n "$SN" ]; then
        SHORT_NAME="$SN"
    fi
fi

POSTER_FILE="poster.html"

cat > "$POSTER_FILE" << 'HEREDOC_START'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Society Payment Portal — QR Code Poster</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page { size: A4; margin: 0; }
  
  body {
    font-family: 'DM Sans', sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #f3f4f6;
  }
  
  .poster {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  
  .poster::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 12px;
    background: linear-gradient(90deg, #1a6b4a, #2d8f66, #34a070, #2d8f66, #1a6b4a);
  }
  
  .header {
    text-align: center;
    margin-top: 30px;
    margin-bottom: 30px;
  }
  
  .icon {
    font-size: 64px;
    margin-bottom: 12px;
  }
  
  .society-name {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 800;
    color: #1a6b4a;
    line-height: 1.2;
  }
  
  .subtitle {
    font-size: 16px;
    color: #6b7280;
    margin-top: 6px;
    font-weight: 500;
  }
  
  .divider {
    width: 80px;
    height: 3px;
    background: linear-gradient(90deg, #1a6b4a, #2d8f66);
    border-radius: 2px;
    margin: 20px auto;
  }
  
  .main-text {
    text-align: center;
    margin-bottom: 30px;
  }
  
  .main-text h2 {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    color: #1f2937;
    margin-bottom: 10px;
  }
  
  .main-text p {
    font-size: 16px;
    color: #6b7280;
    max-width: 400px;
    line-height: 1.6;
  }
  
  .qr-container {
    background: #f0fdf4;
    border: 3px solid #bbf7d0;
    border-radius: 24px;
    padding: 30px;
    margin: 20px 0;
    text-align: center;
  }
  
  .qr-container img {
    width: 250px;
    height: 250px;
    border-radius: 12px;
  }
  
  .scan-text {
    margin-top: 14px;
    font-size: 18px;
    font-weight: 700;
    color: #1a6b4a;
  }
  
  .url-box {
    margin-top: 20px;
    padding: 14px 28px;
    background: #1a6b4a;
    color: #fff;
    border-radius: 12px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
    word-break: break-all;
  }
  
  .features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin: 30px 0;
    width: 100%;
    max-width: 480px;
  }
  
  .feature {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }
  
  .feature-icon { font-size: 24px; }
  .feature-text {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }
  
  .methods {
    text-align: center;
    margin: 10px 0 20px;
  }
  
  .methods-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #9ca3af;
    font-weight: 600;
    margin-bottom: 10px;
  }
  
  .method-icons {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .method-chip {
    padding: 6px 14px;
    background: #f3f4f6;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: #4b5563;
  }
  
  .footer {
    margin-top: auto;
    text-align: center;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    width: 100%;
  }
  
  .footer p {
    font-size: 12px;
    color: #9ca3af;
    line-height: 1.6;
  }
  
  .secure-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    background: #d1fae5;
    color: #065f46;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  
  @media print {
    body { background: #fff; }
    .poster { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="poster">
  <div class="header">
    <div class="icon">🏘️</div>
    <div class="society-name" id="societyName">SOCIETY_NAME_PLACEHOLDER</div>
    <div class="subtitle">Online Payment Portal</div>
  </div>
  
  <div class="divider"></div>
  
  <div class="main-text">
    <h2>Pay Society Dues Online</h2>
    <p>Scan the QR code below or visit the link to make your maintenance and other payments instantly</p>
  </div>
  
  <div class="qr-container">
    <img id="qrImage" src="" alt="QR Code" />
    <div class="scan-text">📱 Scan with any UPI / Camera app</div>
  </div>
  
  <div class="url-box" id="urlBox">URL_PLACEHOLDER</div>
  
  <div class="features">
    <div class="feature"><span class="feature-icon">⚡</span><span class="feature-text">Instant Receipts</span></div>
    <div class="feature"><span class="feature-icon">🔒</span><span class="feature-text">Secure Payments</span></div>
    <div class="feature"><span class="feature-icon">📧</span><span class="feature-text">Email Confirmation</span></div>
    <div class="feature"><span class="feature-icon">📋</span><span class="feature-text">Payment History</span></div>
  </div>
  
  <div class="methods">
    <div class="methods-label">Accepted Payment Methods</div>
    <div class="method-icons">
      <span class="method-chip">⚡ UPI</span>
      <span class="method-chip">💳 Debit Card</span>
      <span class="method-chip">🏦 Credit Card</span>
      <span class="method-chip">🏛️ Net Banking</span>
    </div>
  </div>
  
  <div class="footer">
    <div class="secure-badge">🔒 Secured by Razorpay</div>
    <p>
      For assistance, contact the society office or email the treasurer.<br>
      Powered by SocietyPay (Open Source)
    </p>
  </div>
</div>

<script>
  // Replace placeholders
  const url = "URL_PLACEHOLDER";
  const name = "SOCIETY_NAME_PLACEHOLDER";
  
  document.getElementById('societyName').textContent = name;
  document.getElementById('urlBox').textContent = url;
  
  // Generate QR code using Google Charts API (free, no auth)
  const qrUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(url)}&choe=UTF-8`;
  document.getElementById('qrImage').src = qrUrl;
</script>
</body>
</html>
HEREDOC_START

# Replace placeholders
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|URL_PLACEHOLDER|$URL|g" "$POSTER_FILE"
    sed -i '' "s|SOCIETY_NAME_PLACEHOLDER|$SOCIETY_NAME|g" "$POSTER_FILE"
else
    sed -i "s|URL_PLACEHOLDER|$URL|g" "$POSTER_FILE"
    sed -i "s|SOCIETY_NAME_PLACEHOLDER|$SOCIETY_NAME|g" "$POSTER_FILE"
fi

echo ""
echo "🏘️  SocietyPay — Poster Generated!"
echo "================================="
echo ""
echo "   📄 File:  $POSTER_FILE"
echo "   🔗 URL:   $URL"
echo "   🏠 Society: $SOCIETY_NAME"
echo ""
echo "   Open in browser and press Ctrl+P to print."
echo ""

# Try to open in browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$POSTER_FILE" 2>/dev/null || true
elif command -v xdg-open &> /dev/null; then
    xdg-open "$POSTER_FILE" 2>/dev/null || true
fi

echo "   💡 Print this poster and put it on your society notice board!"
echo "   💡 Share the URL in your society WhatsApp group!"
echo ""
