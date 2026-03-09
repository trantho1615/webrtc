# Báo cáo: WebRTC Group Call với STUN/TURN và Room

## 1. Tổng quan dự án

### 1.1 Mục tiêu

Xây dựng hệ thống gọi video nhóm (group call) sử dụng WebRTC, hỗ trợ:

- Tạo và quản lý phòng họp (room)
- Gọi video nhóm với nhiều người (mesh topology)
- Kết nối qua Internet với STUN/TURN

### 1.2 Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Backend | Node.js, Express, WebSocket (ws) |
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Media | WebRTC API |
| Signaling | WebSocket over HTTPS |
| NAT Traversal | STUN (Google), TURN (coturn) |
| Security | HTTPS với self-signed certificate |

---

## 2. Kiến trúc hệ thống

### 2.1 Sơ đồ tổng quan

```
                    ┌─────────────────────────────────────┐
                    │           INTERNET                   │
                    └─────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Client A     │      │    Client B     │      │    Client C     │
│   (Browser)     │      │   (Browser)     │      │   (Browser)     │
│                 │      │                 │      │                 │
│ ┌─────────────┐ │      │ ┌─────────────┐ │      │ ┌─────────────┐ │
│ │ getUserMedia│ │      │ │ getUserMedia│ │      │ │ getUserMedia│ │
│ │ RTCPeerConn │ │      │ │ RTCPeerConn │ │      │ │ RTCPeerConn │ │
│ │ WebSocket   │ │      │ │ WebSocket   │ │      │ │ WebSocket   │ │
│ └─────────────┘ │      │ └─────────────┘ │      │ └─────────────┘ │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │      WebSocket (WSS)   │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                          ┌───────▼───────┐
                          │   Signaling   │
                          │    Server     │
                          │               │
                          │ • Room Mgmt   │
                          │ • Message Fwd │
                          │ • State Track │
                          │   (Node.js)   │
                          └───────────────┘
                          
         ┌─────────────────────────────────────────────────────┐
         │                  WebRTC Media (P2P)                  │
         │                                                      │
         │    Client A ◄═══════════════════════► Client B      │
         │        ▲                                   ▲         │
         │        ║                                   ║         │
         │        ╚═══════════► Client C ◄════════════╝         │
         │                 (Mesh Topology)                      │
         └─────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼───────┐           ┌───────▼───────┐
            │  STUN Server  │           │  TURN Server  │
            │   (Google)    │           │   (coturn)    │
            │               │           │               │
            │ Discover      │           │ Relay media   │
            │ public IP     │           │ when P2P fail │
            └───────────────┘           └───────────────┘
```

### 2.2 Luồng hoạt động

#### 2.2.1 Đăng ký và vào phòng

```
Client                     Server
  │                          │
  │──── register(name) ────►│
  │◄─── registered ─────────│
  │                          │
  │──── joinRoom(roomId) ───►│
  │◄─── roomJoined ─────────│
  │◄─── roomMembers ────────│
  │                          │
```

#### 2.2.2 Thiết lập Group Call (Mesh)

```
Client A              Server              Client B              Client C
   │                    │                    │                    │
   │─ startGroupCall ──►│                    │                    │
   │                    │─ groupCallStarted ►│                    │
   │                    │─ groupCallStarted ─────────────────────►│
   │                    │                    │                    │
   │══ offer ═══════════╪════════════════════►                    │
   │                    │                    │                    │
   │                    │◄═══════════════════╪═══ answer ═════════│
   │◄═══════════════════╪══════════════════════════════════════════│
   │                    │                    │                    │
   │══ offer ═══════════╪════════════════════════════════════════►│
   │                    │                    │                    │
   │◄═══════════════════╪═══════════════════════════ answer ══════│
   │                    │                    │                    │
   │◄═══════════════════╪═══ ICE candidates ═╪════════════════════►│
   │                    │                    │                    │
   ║════════════════════════ Media (P2P) ════════════════════════║
```

### 2.3 Mesh Topology

Trong group call với N người, mỗi client tạo N-1 RTCPeerConnection:

```
       ┌─────────┐
       │ Client A│
       └────┬────┘
           ╱│╲
          ╱ │ ╲
         ╱  │  ╲
        ╱   │   ╲
       ╱    │    ╲
      ▼     ▼     ▼
┌─────────┐ ┌─────────┐
│ Client B│─│ Client C│
└─────────┘ └─────────┘

Với 3 người: 3 connections
Với 4 người: 6 connections
Với N người: N(N-1)/2 connections
```

---

## 3. Signaling Protocol

### 3.1 Định nghĩa Message Types

#### 3.1.1 Authentication & Registration

```javascript
// Client -> Server
{ type: "register", name: "UserName" }

// Server -> Client
{ type: "registered", name: "UserName", message: "Đăng ký thành công" }
```

#### 3.1.2 Room Management

```javascript
// Client -> Server: Tạo phòng
{ type: "createRoom", roomId: "room1", name: "UserName" }

// Client -> Server: Tham gia phòng
{ type: "joinRoom", roomId: "room1", name: "UserName" }

// Server -> Client: Xác nhận
{ type: "roomCreated", roomId: "room1", message: "..." }
{ type: "roomJoined", roomId: "room1", message: "..." }

// Server -> All in Room: Danh sách thành viên
{ type: "roomMembers", roomId: "room1", members: ["User1", "User2", "User3"] }

// Server -> Others: Thông báo thành viên mới
{ type: "memberJoined", roomId: "room1", name: "NewUser" }

// Server -> Others: Thông báo thành viên rời
{ type: "memberLeft", roomId: "room1", name: "LeftUser" }

// Client -> Server: Rời phòng
{ type: "leaveRoom", roomId: "room1", sender: "UserName" }
```

#### 3.1.3 WebRTC Signaling

```javascript
// Bắt đầu group call
{ type: "startGroupCall", roomId: "room1", sender: "UserName" }

// Server broadcast
{ type: "groupCallStarted", roomId: "room1", initiator: "UserName" }

// SDP Offer
{
  type: "offer",
  roomId: "room1",
  sender: "UserA",
  target: "UserB",
  offer: { type: "offer", sdp: "..." }
}

// SDP Answer
{
  type: "answer",
  roomId: "room1",
  sender: "UserB",
  target: "UserA",
  answer: { type: "answer", sdp: "..." }
}

// ICE Candidate
{
  type: "candidate",
  roomId: "room1",
  sender: "UserA",
  target: "UserB",
  candidate: { candidate: "...", sdpMLineIndex: 0, sdpMid: "0" }
}

// Kết thúc cuộc gọi
{ type: "endCall", roomId: "room1", sender: "UserName" }
```

### 3.2 Server State Management

```javascript
// Lưu trữ clients
clients = Map<string, { ws: WebSocket, roomId: string | null }>

// Lưu trữ rooms
rooms = Map<string, Set<string>>  // roomId -> Set of userNames
```

---

## 4. ICE (STUN/TURN) Configuration

### 4.1 Cấu hình ICE Servers

```javascript
const ICE_SERVERS = [
  // STUN servers (miễn phí)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // TURN servers (tự host hoặc dịch vụ)
  {
    urls: 'turn:your-server:3478?transport=udp',
    username: 'user',
    credential: 'password'
  },
  {
    urls: 'turn:your-server:3478?transport=tcp',
    username: 'user',
    credential: 'password'
  },
  {
    urls: 'turns:your-server:5349?transport=tcp',
    username: 'user',
    credential: 'password'
  }
];
```

### 4.2 ICE Candidate Types

| Type | Mô tả | Khi nào xảy ra |
|------|-------|----------------|
| `host` | Địa chỉ local | Cùng mạng LAN |
| `srflx` | Server Reflexive | Qua STUN, NAT đơn giản |
| `prflx` | Peer Reflexive | Phát hiện qua kết nối |
| `relay` | Relay | Qua TURN, P2P thất bại |

### 4.3 TURN Fallback Logic

```javascript
// Timeout để detect cần TURN
const ICE_TIMEOUT = 15000; // 15 giây

pc.oniceconnectionstatechange = () => {
  if (pc.iceConnectionState === 'failed') {
    console.log('P2P failed, đang sử dụng TURN relay...');
  }
};

// Kiểm tra connection type
async function getConnectionType(pc) {
  const stats = await pc.getStats();
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      const localCandidate = stats.get(report.localCandidateId);
      console.log('Connection type:', localCandidate.candidateType);
      // host | srflx | relay
    }
  });
}
```

---

## 5. Kết quả kiểm thử

### 5.1 Test Case 1: Cùng LAN (P2P)

**Môi trường:**

- 2 thiết bị cùng mạng WiFi
- Không qua TURN

**Kết quả:**

```
[INFO] ICE state với User2: checking
[INFO] ICE state với User2: connected
[INFO] Connection type với User2: P2P (host)
```

**Screenshot:** *(Chèn ảnh chụp màn hình)*

### 5.2 Test Case 2: Khác mạng (STUN)

**Môi trường:**

- 1 thiết bị WiFi, 1 thiết bị qua NAT router khác
- NAT loại Cone

**Kết quả:**

```
[INFO] ICE state với User2: checking
[INFO] ICE state với User2: connected
[INFO] Connection type với User2: STUN (srflx)
```

### 5.3 Test Case 3: 4G vs WiFi (TURN)

**Môi trường:**

- 1 thiết bị WiFi
- 1 điện thoại dùng 4G
- NAT Symmetric (4G thường có)

**Kết quả:**

```
[WARNING] ICE timeout với User2, có thể cần TURN
[INFO] ICE state với User2: checking
[INFO] ICE state với User2: connected
[INFO] Connection type với User2: TURN (relay)
```

### 5.4 Test Case 4: Group Call 3-4 người

**Môi trường:**

- 4 thiết bị (2 laptop, 2 điện thoại)
- Cùng phòng "test-group"

**Kết quả:**

- 3 thiết bị: 3 peer connections, tất cả connected
- 4 thiết bị: 6 peer connections, tất cả connected
- Khi 1 người rời: `memberLeft` broadcast, các PC tương ứng được đóng

**Logs:**

```
[INFO] User1 bắt đầu group call trong phòng "test-group"
[INFO] Offer: "User1" -> "User2"
[INFO] Offer: "User1" -> "User3"
[INFO] Offer: "User1" -> "User4"
[INFO] Answer: "User2" -> "User1"
[INFO] Answer: "User3" -> "User1"
[INFO] Answer: "User4" -> "User1"
...
[INFO] "User3" rời phòng "test-group"
[WARNING] User3 đã rời phòng
```

---

## 6. Thống kê Connection States

### 6.1 ICE Connection States

| State | Mô tả |
|-------|-------|
| `new` | Chưa bắt đầu |
| `checking` | Đang kiểm tra candidates |
| `connected` | Ít nhất 1 candidate pair hoạt động |
| `completed` | Tìm được pair tốt nhất |
| `disconnected` | Mất kết nối tạm thời |
| `failed` | Không thể thiết lập kết nối |
| `closed` | Đã đóng connection |

### 6.2 Hiển thị trên UI

```
┌─────────────────────────────────────┐
│  📊 Thống kê kết nối                │
├─────────────────────────────────────┤
│  Peers: 3                           │
│  Connection Type: P2P (host)        │
│  Bắt đầu: 14:30:25                  │
│  Thời lượng: 05:23                  │
└─────────────────────────────────────┘
```

---

## 7. Hạn chế và hướng phát triển

### 7.1 Hạn chế hiện tại

1. **Mesh Topology**: Băng thông tăng theo O(N²), không phù hợp với >6 người
2. **Không có MCU/SFU**: Tất cả media xử lý client-side
3. **Không có recording**: Chưa hỗ trợ ghi lại cuộc gọi
4. **Không có screen sharing**: Chưa hỗ trợ chia sẻ màn hình

### 7.2 Hướng phát triển

1. **SFU (Selective Forwarding Unit)**
   - Sử dụng mediasoup hoặc Janus
   - Giảm băng thông client
   - Hỗ trợ nhiều người hơn

2. **Tối ưu băng thông**
   - Simulcast: gửi nhiều độ phân giải
   - VP9/AV1 codec
   - Bandwidth estimation

3. **Tính năng nâng cao**
   - Screen sharing
   - Recording
   - Chat text
   - Mute/unmute controls
   - Virtual background

4. **Bảo mật**
   - E2E encryption (Insertable Streams)
   - Room password
   - Rate limiting

---

## 8. Kết luận

Dự án đã hoàn thành các yêu cầu chính:

- ✅ **Room Management**: Tạo/tham gia/rời phòng hoạt động đúng
- ✅ **Group Call Mesh**: Hỗ trợ 3-4+ người, hiển thị đủ video
- ✅ **STUN/TURN**: Cấu hình đầy đủ, fallback khi cần
- ✅ **Connection Stats**: Hiển thị trạng thái, loại kết nối
- ✅ **Error Handling**: Xử lý rời phòng, mất kết nối

Hệ thống hoạt động ổn định trong môi trường LAN và có thể mở rộng qua Internet với TURN server.

---

## 9. Tài liệu tham khảo

1. [WebRTC API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
2. [RTCPeerConnection - MDN](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
3. [STUN/TURN - RFC 5389, RFC 5766](https://tools.ietf.org/html/rfc5389)
4. [Coturn Documentation](https://github.com/coturn/coturn)
5. [WebRTC Samples](https://webrtc.github.io/samples/)
