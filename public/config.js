/**
 * Cấu hình Client-side cho WebRTC Group Call
 * Import file này vào index.html trước script chính
 */

// ===== SIGNALING SERVER URL =====
// Tự động detect URL dựa trên cách truy cập
// - Nếu có port trong URL (localhost:3000) → dùng port đó
// - Nếu không có port (ngrok, domain) → dùng default HTTPS port
const getSignalingUrl = () => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = location.hostname;
  // Nếu URL có port thì dùng, không thì bỏ qua (ngrok dùng 443 mặc định)
  const port = location.port ? `:${location.port}` : '';
  return `${protocol}//${host}${port}`;
};

window.SIGNALING_URL = getSignalingUrl();
// Ví dụ kết quả:
// - localhost:3000 → wss://localhost:3000
// - abc123.ngrok-free.app → wss://abc123.ngrok-free.app (không có port)

// ===== ICE SERVERS CONFIGURATION =====
// Cấu hình STUN/TURN servers
window.ICE_SERVERS_CONFIG = [
  // STUN servers (miễn phí)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // ===== TURN servers - Metered.ca Free TURN =====
  // Đăng ký miễn phí tại: https://www.metered.ca/tools/openrelay/
  {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "e066f6a33afbc391d11e7d83",
        credential: "ZyqszO9QnUeF1R3r",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "e066f6a33afbc391d11e7d83",
        credential: "ZyqszO9QnUeF1R3r",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "e066f6a33afbc391d11e7d83",
        credential: "ZyqszO9QnUeF1R3r",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "e066f6a33afbc391d11e7d83",
        credential: "ZyqszO9QnUeF1R3r",
      }
];

// ===== NẾU MUỐN DÙNG COTURN LOCAL, THAY THẾ BẰNG CẤU HÌNH NÀY =====
/*
window.ICE_SERVERS_CONFIG = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:YOUR_SERVER_IP:3478?transport=udp',
    username: 'webrtc',
    credential: 'webrtc123'
  },
  {
    urls: 'turn:YOUR_SERVER_IP:3478?transport=tcp',
    username: 'webrtc',
    credential: 'webrtc123'
  },
  {
    urls: 'turns:YOUR_SERVER_IP:5349?transport=tcp',
    username: 'webrtc',
    credential: 'webrtc123'
  }
];
*/

// ===== TIMEOUT SETTINGS =====
// Thời gian chờ ICE connection trước khi báo cần TURN (ms)
window.ICE_CONNECTION_TIMEOUT = 15000;

// ===== DEBUG MODE =====
// Bật để hiển thị thêm logs
window.DEBUG_MODE = true;
