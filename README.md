# WebRTC Group Call - Room-based Video Conferencing

Hệ thống gọi video nhóm sử dụng WebRTC với hỗ trợ STUN/TURN, cho phép nhiều người tham gia cùng một phòng họp.

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Yêu cầu](#-yêu-cầu)
- [Cài đặt](#-cài-đặt)
- [Tạo SSL Certificate](#-tạo-ssl-certificate)
- [Cấu hình TURN Server](#-cấu-hình-turn-server-coturn)
- [Chạy ứng dụng](#-chạy-ứng-dụng)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Testing](#-testing)
- [Signaling Protocol](#-signaling-protocol)
- [Troubleshooting](#-troubleshooting)

## ✨ Tính năng

- ✅ **Room-based**: Tạo và tham gia phòng họp bằng Room ID
- ✅ **Group Call**: Gọi video nhóm với nhiều người (mesh topology)
- ✅ **STUN/TURN**: Hỗ trợ kết nối qua NAT/Firewall
- ✅ **Realtime Updates**: Cập nhật danh sách thành viên realtime
- ✅ **Connection Stats**: Hiển thị trạng thái kết nối, loại connection (P2P/STUN/TURN)
- ✅ **Responsive UI**: Giao diện grid video tự động điều chỉnh
- ✅ **Error Handling**: Xử lý lỗi khi mất kết nối, rời phòng

## 🏗 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      INTERNET                                │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Client A   │      │  Client B   │      │  Client C   │
│  (Browser)  │      │  (Browser)  │      │  (Browser)  │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │     WebSocket (Signaling)               │
       └──────────────┬─────┴────────────────────┘
                      │
              ┌───────▼───────┐
              │   Signaling   │
              │    Server     │
              │  (Node.js)    │
              └───────────────┘
                      
       ┌──────────────────────────────────┐
       │         Media Flow (WebRTC)       │
       │                                   │
       │   Client A ◄──► Client B         │
       │       ▲            ▲              │
       │       │            │              │
       │       └────► Client C            │
       │         (Mesh Topology)           │
       └──────────────────────────────────┘
                      │
              ┌───────▼───────┐
              │  STUN / TURN  │
              │    Servers    │
              └───────────────┘
```

## 📦 Yêu cầu

- **Node.js** >= 14.x
- **npm** >= 6.x
- **OpenSSL** (để tạo SSL certificate)
- **Docker** (tùy chọn, để chạy coturn)

## 🚀 Cài đặt

### 1. Clone hoặc tải source code

```bash
cd webrtc-app-v2
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cài thêm dotenv (nếu chưa có)

```bash
npm install dotenv
```

### 4. Tạo file cấu hình

```bash
cp .env.example .env
```

Chỉnh sửa `.env` theo môi trường của bạn.

## 🔐 Tạo SSL Certificate

WebRTC yêu cầu HTTPS. Tạo self-signed certificate cho development:

### Cách 1: Sử dụng OpenSSL

```bash
# Tạo thư mục certs
mkdir -p certs

# Tạo private key và certificate
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"
```

### Cách 2: Script tự động

```bash
# Tạo script
cat > create-certs.sh << 'EOF'
#!/bin/bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 -nodes \
  -subj "/C=VN/ST=HCM/L=HCM/O=WebRTC/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:YOUR_IP"
echo "Certificates created in ./certs/"
EOF

chmod +x create-certs.sh
./create-certs.sh
```

**Lưu ý**: Thay `YOUR_IP` bằng IP thực của máy bạn (ví dụ: `192.168.1.100`).

## 🔄 Cấu hình TURN Server (Coturn)

TURN server cần thiết khi P2P không thể thiết lập (NAT symmetric, firewall).

### Cách 1: Chạy Coturn với Docker (Khuyến nghị)

```bash
# Pull image coturn
docker pull coturn/coturn

# Chạy coturn container
docker run -d --name coturn \
  --network host \
  coturn/coturn \
  -n \
  --log-file=stdout \
  --min-port=49152 \
  --max-port=65535 \
  --realm=webrtc.local \
  --user=webrtc:webrtc123 \
  --lt-cred-mech \
  --fingerprint \
  --listening-port=3478 \
  --tls-listening-port=5349 \
  --external-ip=YOUR_PUBLIC_IP
```

Thay `YOUR_PUBLIC_IP` bằng IP public của server.

### Cách 2: Cài đặt Coturn trực tiếp (Ubuntu/Debian)

```bash
# Cài đặt
sudo apt-get update
sudo apt-get install coturn

# Bật coturn service
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# Cấu hình /etc/turnserver.conf
sudo cat > /etc/turnserver.conf << EOF
listening-port=3478
tls-listening-port=5349
realm=webrtc.local
server-name=webrtc.local
lt-cred-mech
user=webrtc:webrtc123
fingerprint
log-file=/var/log/turnserver.log
simple-log
EOF

# Khởi động
sudo systemctl restart coturn
sudo systemctl enable coturn
```

### Cách 3: Sử dụng dịch vụ TURN miễn phí/trả phí

- **Metered.ca**: https://www.metered.ca/tools/openrelay/
- **Twilio**: https://www.twilio.com/stun-turn
- **Xirsys**: https://xirsys.com/

### Cấu hình TURN trong client

Chỉnh sửa file `public/config.js`:

```javascript
window.ICE_SERVERS_CONFIG = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:YOUR_TURN_SERVER:3478?transport=udp',
    username: 'webrtc',
    credential: 'webrtc123'
  },
  {
    urls: 'turn:YOUR_TURN_SERVER:3478?transport=tcp',
    username: 'webrtc',
    credential: 'webrtc123'
  }
];
```

## ▶️ Chạy ứng dụng

### Development

```bash
# Chạy server
node server.js

# Hoặc với nodemon (tự restart khi thay đổi code)
npm install -g nodemon
nodemon server.js
```

Server sẽ chạy tại: `https://localhost:3000`

### Production

```bash
# Sử dụng PM2
npm install -g pm2
pm2 start server.js --name webrtc-server
pm2 save
pm2 startup
```

## 📖 Hướng dẫn sử dụng

### 1. Truy cập ứng dụng

Mở trình duyệt và truy cập: `https://localhost:3000`

**Lưu ý**: Với self-signed certificate, cần chấp nhận cảnh báo bảo mật:
- Chrome: Click "Advanced" → "Proceed to localhost (unsafe)"
- Firefox: Click "Advanced" → "Accept the Risk and Continue"

### 2. Đăng ký tên

- Nhập tên của bạn vào ô "Tên của bạn"
- Click "Đăng ký"
- Cho phép truy cập camera/microphone

### 3. Tạo/Tham gia phòng

- Nhập Room ID (ví dụ: "room1", "meeting-abc")
- Click "Tạo phòng" hoặc "Tham gia"

### 4. Bắt đầu Group Call

- Khi có ít nhất 2 người trong phòng
- Click "Bắt đầu Group Call"
- Video của các thành viên sẽ hiển thị trong grid

### 5. Kết thúc cuộc gọi

- Click "Kết thúc" để dừng cuộc gọi
- Click "Rời phòng" để thoát khỏi phòng

## 🧪 Testing

### Test 2 người (cùng máy)

1. Mở 2 tab trình duyệt đến `https://localhost:3000`
2. Tab 1: Đăng ký "User1", tạo phòng "test-room"
3. Tab 2: Đăng ký "User2", tham gia phòng "test-room"
4. Một trong hai click "Bắt đầu Group Call"

### Test 2 người (khác máy, cùng LAN)

1. Lấy IP của máy chạy server: `ip addr show` hoặc `ifconfig`
2. Máy 1: Truy cập `https://YOUR_IP:3000`
3. Máy 2: Truy cập `https://YOUR_IP:3000`
4. Làm các bước như trên

### Test 3-4 người (Group Call)

1. Mở 3-4 tab/máy khác nhau
2. Tất cả đăng ký với tên khác nhau
3. Tất cả tham gia cùng một Room ID
4. Một người click "Bắt đầu Group Call"
5. Các người khác sẽ tự động kết nối

### Test TURN (khác mạng/4G)

1. Đảm bảo đã cấu hình TURN server
2. Một người dùng WiFi, một người dùng 4G
3. Kiểm tra log để xác nhận sử dụng TURN:
   - Mở DevTools (F12) → Console
   - Tìm log: "Connection type: TURN (relay)"

### Kiểm tra loại kết nối

Trong Console của trình duyệt, bạn sẽ thấy:
- `Connection type: P2P (host)` - Kết nối trực tiếp (cùng LAN)
- `Connection type: STUN (srflx)` - Qua STUN server
- `Connection type: TURN (relay)` - Qua TURN server

## 📡 Signaling Protocol

### Message Types

| Type | Mô tả | Payload |
|------|-------|---------|
| `register` | Đăng ký tên | `{ type, name }` |
| `registered` | Xác nhận đăng ký | `{ type, name, message }` |
| `createRoom` | Tạo phòng | `{ type, roomId, name }` |
| `joinRoom` | Tham gia phòng | `{ type, roomId, name }` |
| `roomMembers` | Danh sách thành viên | `{ type, roomId, members[] }` |
| `memberJoined` | Có người mới | `{ type, roomId, name }` |
| `memberLeft` | Có người rời | `{ type, roomId, name }` |
| `leaveRoom` | Rời phòng | `{ type, roomId, sender }` |
| `startGroupCall` | Bắt đầu call | `{ type, roomId, sender }` |
| `offer` | SDP Offer | `{ type, roomId, sender, target, offer }` |
| `answer` | SDP Answer | `{ type, roomId, sender, target, answer }` |
| `candidate` | ICE Candidate | `{ type, roomId, sender, target, candidate }` |
| `endCall` | Kết thúc call | `{ type, roomId, sender }` |
| `error` | Lỗi | `{ type, message }` |

## ❓ Troubleshooting

### Lỗi "Không truy cập được camera/mic"

- Đảm bảo đang sử dụng HTTPS
- Kiểm tra quyền truy cập camera/mic trong trình duyệt
- Thử với trình duyệt khác

### Lỗi "WebSocket connection failed"

- Kiểm tra server đang chạy
- Kiểm tra firewall không chặn port 3000
- Đảm bảo URL signaling đúng trong `config.js`

### Video không hiển thị

- Kiểm tra ICE connection state trong logs
- Nếu "failed", cần cấu hình TURN server
- Kiểm tra firewall không chặn UDP ports

### Kết nối P2P thất bại (cần TURN)

- Kiểm tra TURN server đang chạy: `turnutils_stunclient -p 3478 YOUR_TURN_SERVER`
- Đảm bảo ports 3478 (UDP/TCP) và 5349 (TLS) được mở
- Kiểm tra credentials đúng

### Test TURN connectivity

```bash
# Cài đặt coturn-utils
sudo apt-get install coturn-utils

# Test STUN
turnutils_stunclient YOUR_TURN_SERVER

# Test TURN
turnutils_uclient -u webrtc -w webrtc123 YOUR_TURN_SERVER
```

## 📁 Cấu trúc thư mục

```
webrtc-app-v2/
├── server.js           # Signaling server (Node.js)
├── package.json        # Dependencies
├── .env.example        # Mẫu cấu hình environment
├── .env                # Cấu hình (không commit)
├── README.md           # Tài liệu này
├── report.md           # Báo cáo chi tiết
├── certs/              # SSL certificates
│   ├── key.pem
│   └── cert.pem
└── public/             # Client files
    ├── index.html      # Giao diện chính
    └── config.js       # Cấu hình client
```

## 📄 License

MIT License
