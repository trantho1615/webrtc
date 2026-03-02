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
// Cấu hình STUN/TURN servers được fetch từ server API (không hardcode credentials)
// Fallback nếu API không khả dụng
window.ICE_SERVERS_CONFIG = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Hàm lấy ICE config từ server API
window.fetchIceServersConfig = async () => {
  try {
    const response = await fetch('/api/ice-config');
    if (response.ok) {
      const data = await response.json();
      window.ICE_SERVERS_CONFIG = data.iceServers;
      console.log('ICE servers config loaded from server');
    }
  } catch (error) {
    console.warn('Could not fetch ICE config from server, using fallback STUN servers:', error);
  }
  return window.ICE_SERVERS_CONFIG;
};

// Tự động fetch khi load
window.fetchIceServersConfig();

// ===== TIMEOUT SETTINGS =====
// Thời gian chờ ICE connection trước khi báo cần TURN (ms)
window.ICE_CONNECTION_TIMEOUT = 15000;

// ===== DEBUG MODE =====
// Bật để hiển thị thêm logs
window.DEBUG_MODE = true;
