/**
 * Cấu hình Client-side cho WebRTC Group Call
 * Import file này vào index.html trước script chính
 */

// ===== SIGNALING SERVER URL =====
// Thay đổi theo địa chỉ server của bạn
window.SIGNALING_URL = 'wss://192.168.100.122:3000';
// Ví dụ: window.SIGNALING_URL = 'wss://192.168.1.100:3000';
// Ví dụ: window.SIGNALING_URL = 'wss://your-domain.com:3000';

// ===== ICE SERVERS CONFIGURATION =====
// Cấu hình STUN/TURN servers
window.ICE_SERVERS_CONFIG = [
  // STUN servers (miễn phí)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // TURN servers - QUAN TRỌNG cho kết nối qua Internet
  // Uncomment và cấu hình khi có TURN server
  
  /*
  // TURN UDP
  {
    urls: 'turn:YOUR_TURN_SERVER:3478?transport=udp',
    username: 'YOUR_USERNAME',
    credential: 'YOUR_PASSWORD'
  },
  
  // TURN TCP (cho firewall chặn UDP)
  {
    urls: 'turn:YOUR_TURN_SERVER:3478?transport=tcp',
    username: 'YOUR_USERNAME',
    credential: 'YOUR_PASSWORD'
  },
  
  // TURNS (TURN over TLS) - Port 443 thường không bị chặn
  {
    urls: 'turns:YOUR_TURN_SERVER:5349?transport=tcp',
    username: 'YOUR_USERNAME',
    credential: 'YOUR_PASSWORD'
  }
  */
];

// ===== VÍ DỤ VỚI COTURN LOCAL =====
/*
window.ICE_SERVERS_CONFIG = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:localhost:3478?transport=udp',
    username: 'webrtc',
    credential: 'webrtc123'
  },
  {
    urls: 'turn:localhost:3478?transport=tcp',
    username: 'webrtc',
    credential: 'webrtc123'
  }
];
*/

// ===== VÍ DỤ VỚI DỊCH VỤ TURN (Metered, Twilio, etc.) =====
/*
window.ICE_SERVERS_CONFIG = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:a]global.turn.twilio.com:3478?transport=udp',
    username: 'your-twilio-username',
    credential: 'your-twilio-credential'
  }
];
*/

// ===== TIMEOUT SETTINGS =====
// Thời gian chờ ICE connection trước khi báo cần TURN (ms)
window.ICE_CONNECTION_TIMEOUT = 15000;

// ===== DEBUG MODE =====
// Bật để hiển thị thêm logs
window.DEBUG_MODE = true;
