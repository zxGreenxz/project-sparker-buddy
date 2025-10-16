/**
 * XC80 Print Bridge Server v6.0 - BITMAP SUPPORT
 * Hỗ trợ CP1258 (Windows-1258) cho tiếng Việt có dấu
 * Hỗ trợ in BITMAP trực tiếp từ canvas
 * 
 * Cách chạy:
 * npm install express body-parser cors iconv-lite
 * node xc80-bridge-cp1258.js
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const net = require('net');
const iconv = require('iconv-lite');

const app = express();
const PORT = 9100;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' }));

// ESC/POS Constants
const ESC = '\x1B';
const GS = '\x1D';

/**
 * CP1258 Encoding Map (Unicode → Windows-1258)
 */
const CP1258_MAP = {
  // Lowercase vowels
  'à': '\xE0', 'á': '\xE1', 'ả': '\xE3', 'ã': '\xE3', 'ạ': '\xE1',
  'ằ': '\xE0', 'ắ': '\xE1', 'ẳ': '\xE3', 'ẵ': '\xE3', 'ặ': '\xE1',
  'è': '\xE8', 'é': '\xE9', 'ẻ': '\xEB', 'ẽ': '\xEB', 'ẹ': '\xE9',
  'ì': '\xEC', 'í': '\xED', 'ỉ': '\xEF', 'ĩ': '\xEF', 'ị': '\xED',
  'ò': '\xF2', 'ó': '\xF3', 'ỏ': '\xF5', 'õ': '\xF5', 'ọ': '\xF3',
  'ù': '\xF9', 'ú': '\xFA', 'ủ': '\xFC', 'ũ': '\xFC', 'ụ': '\xFA',
  'ỳ': '\xFD', 'ý': '\xFD', 'ỷ': '\xFF', 'ỹ': '\xFF', 'ỵ': '\xFD',
  
  // Special characters
  'đ': '\xF0', 'Đ': '\xD0',
  
  // Uppercase vowels  
  'À': '\xC0', 'Á': '\xC1', 'Ả': '\xC3', 'Ã': '\xC3', 'Ạ': '\xC1',
  'È': '\xC8', 'É': '\xC9', 'Ẻ': '\xCB', 'Ẽ': '\xCB', 'Ẹ': '\xC9',
  'Ì': '\xCC', 'Í': '\xCD', 'Ỉ': '\xCF', 'Ĩ': '\xCF', 'Ị': '\xCD',
  'Ò': '\xD2', 'Ó': '\xD3', 'Ỏ': '\xD5', 'Õ': '\xD5', 'Ọ': '\xD3',
  'Ù': '\xD9', 'Ú': '\xDA', 'Ủ': '\xDC', 'Ũ': '\xDC', 'Ụ': '\xDA',
  'Ỳ': '\xDD', 'Ý': '\xDD', 'Ỷ': '\xDF', 'Ỹ': '\xDF', 'Ỵ': '\xDD'
};

/**
 * Chuyển Unicode sang CP1258
 */
function convertToCP1258(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += CP1258_MAP[char] || char;
  }
  return result;
}

/**
 * Bỏ dấu tiếng Việt
 */
function removeVietnameseTones(str) {
  const tones = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'Đ': 'D',
    'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
  };
  
  return str.split('').map(char => tones[char] || char).join('');
}

/**
 * Tạo ESC/POS commands cho TEXT
 */
function buildTextESCPOS(content, options = {}) {
  const {
    mode = 'cp1258',
    align = 'left',
    feeds = 3
  } = options;
  
  const commands = [];
  
  // Initialize
  commands.push(Buffer.from([0x1B, 0x40])); // ESC @
  
  // Set Code Page
  if (mode === 'cp1258') {
    commands.push(Buffer.from([0x1B, 0x74, 0x1E])); // ESC t 30
    content = convertToCP1258(content);
  } else if (mode === 'no-accents') {
    commands.push(Buffer.from([0x1B, 0x74, 0x00])); // ESC t 0
    content = removeVietnameseTones(content);
  }
  
  // Alignment
  const alignCode = { left: 0x00, center: 0x01, right: 0x02 }[align] || 0x00;
  commands.push(Buffer.from([0x1B, 0x61, alignCode]));
  
  // Content
  commands.push(Buffer.from(content, 'binary'));
  
  // Paper feed
  if (feeds > 0) {
    commands.push(Buffer.from([0x1B, 0x64, feeds]));
  }
  
  // Cut paper
  commands.push(Buffer.from([0x1D, 0x56, 0x00]));
  
  return Buffer.concat(commands);
}

/**
 * Gửi data đến máy in
 */
async function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host: ip, port, timeout: 5000 }, () => {
      console.log(`✅ Connected to printer: ${ip}:${port}`);
      
      client.write(data, (err) => {
        if (err) {
          console.error('❌ Write error:', err);
          reject(err);
        } else {
          console.log(`✅ Sent ${data.length} bytes to printer`);
          setTimeout(() => {
            client.end();
            resolve({ success: true });
          }, 500);
        }
      });
    });
    
    client.on('error', (err) => {
      console.error('❌ Connection error:', err);
      reject(err);
    });
    
    client.on('timeout', () => {
      console.error('❌ Connection timeout');
      client.destroy();
      reject(new Error('Connection timeout'));
    });
  });
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '6.0.0',
    features: ['text', 'bitmap', 'cp1258'],
    timestamp: new Date().toISOString()
  });
});

/**
 * Print TEXT (legacy endpoint)
 */
app.post('/print', async (req, res) => {
  try {
    const { ip, port = 9100, content, options = {} } = req.body;
    
    if (!ip || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ip, content'
      });
    }
    
    console.log(`📄 TEXT Print request: ${ip}:${port}`);
    console.log(`📝 Content length: ${content.length} chars`);
    
    const escposData = buildTextESCPOS(content, options);
    const result = await sendToPrinter(ip, port, escposData);
    
    res.json({
      success: true,
      message: 'Print job sent successfully',
      bytes: escposData.length
    });
    
  } catch (error) {
    console.error('❌ Print error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Print BITMAP (new endpoint)
 * Nhận base64 encoded ESC/POS bitmap commands
 */
app.post('/print-bitmap', async (req, res) => {
  try {
    const { ip, port = 9100, bitmap } = req.body;
    
    if (!ip || !bitmap) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ip, bitmap (base64)'
      });
    }
    
    console.log(`🖼️ BITMAP Print request: ${ip}:${port}`);
    console.log(`📦 Bitmap data length: ${bitmap.length} chars (base64)`);
    
    // Decode base64 to binary
    const bitmapData = Buffer.from(bitmap, 'base64');
    console.log(`✅ Decoded to ${bitmapData.length} bytes`);
    
    // Send directly to printer (data already contains ESC/POS commands)
    const result = await sendToPrinter(ip, port, bitmapData);
    
    res.json({
      success: true,
      message: 'Bitmap print job sent successfully',
      bytes: bitmapData.length
    });
    
  } catch (error) {
    console.error('❌ Bitmap print error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Print PDF (convert to image then bitmap)
 * Note: Thermal printers don't support PDF directly
 */
app.post('/print-pdf', async (req, res) => {
  try {
    const { ip, port = 9100, pdfBase64 } = req.body;
    
    if (!ip || !pdfBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ip, pdfBase64'
      });
    }
    
    console.log(`📄 PDF Print request: ${ip}:${port}`);
    console.log(`📦 PDF data length: ${pdfBase64.length} chars (base64)`);
    
    // Note: XC80 thermal printer doesn't support PDF directly
    // This would require converting PDF → Image → ESC/POS bitmap
    // For now, return error suggesting browser print dialog instead
    
    return res.status(501).json({
      success: false,
      error: 'PDF printing not yet implemented for thermal printers. Please use browser print dialog instead.'
    });
    
  } catch (error) {
    console.error('❌ PDF print error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test connection
 */
app.post('/test', async (req, res) => {
  try {
    const { ip, port = 9100 } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: ip'
      });
    }
    
    console.log(`🔍 Testing connection: ${ip}:${port}`);
    
    // Send simple test command (initialize printer)
    const testData = Buffer.from([0x1B, 0x40]); // ESC @
    await sendToPrinter(ip, port, testData);
    
    res.json({
      success: true,
      message: 'Connection test successful',
      printer: `${ip}:${port}`
    });
    
  } catch (error) {
    console.error('❌ Test connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🖨️  XC80 Print Bridge Server v6.0 - BITMAP SUPPORT  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server running on: http://localhost:${PORT}`);
  console.log('');
  console.log('📡 Available endpoints:');
  console.log('   GET  /health          - Health check');
  console.log('   POST /print           - Print TEXT (CP1258 support)');
  console.log('   POST /print-bitmap    - Print BITMAP (ESC/POS format)');
  console.log('   POST /test            - Test printer connection');
  console.log('');
  console.log('🎯 Features:');
  console.log('   ✓ Vietnamese CP1258 encoding');
  console.log('   ✓ Direct bitmap printing');
  console.log('   ✓ ESC/POS GS v 0 format');
  console.log('   ✓ Base64 encoded data');
  console.log('');
  console.log('📖 Example bitmap print request:');
  console.log('   POST http://localhost:9100/print-bitmap');
  console.log('   Body: {');
  console.log('     "ip": "192.168.1.100",');
  console.log('     "port": 9100,');
  console.log('     "bitmap": "<base64-encoded-escpos-data>"');
  console.log('   }');
  console.log('');
  console.log('⚡ Ready to receive print jobs!');
  console.log('');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
