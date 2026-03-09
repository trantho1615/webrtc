/**
 * WebRTC Signaling Server với Room & Group Call
 * Hỗ trợ STUN/TURN, mesh topology cho group call
 */

const fs = require('fs');
const https = require('https');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

const app = express();

// ===== Cấu hình từ biến môi trường =====
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

let options;
try {
  options = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || './certs/key.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || './certs/cert.pem')
  };
} catch (error) {
  console.error('Lỗi tải chứng chỉ SSL:', error.message);
  console.log('Hãy tạo chứng chỉ SSL theo hướng dẫn trong README.md');
  process.exit(1);
}

const server = https.createServer(options, app);
const wss = new WebSocket.Server({ server });
app.use(express.static(path.join(__dirname, 'public')));

// ===== API endpoint: ICE Servers Configuration =====
app.get('/api/ice-config', (req, res) => {
  const iceServers = [
    // STUN servers (miễn phí)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];
  
  // Thêm TURN servers nếu có credentials trong env
  const turnUsername = process.env.METERED_TURN_USERNAME;
  const turnCredential = process.env.METERED_TURN_CREDENTIAL;
  
  if (turnUsername && turnCredential) {
    iceServers.push(
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: turnUsername,
        credential: turnCredential,
      }
    );
  }
  
  res.json({ iceServers });
});

// ===== Data Structures =====
// name -> { ws, roomId }
const clients = new Map();

// roomId -> Set<name>
const rooms = new Map();

// ===== Utility Functions =====

/**
 * Gửi message đến 1 client cụ thể
 */
function sendTo(name, message) {
  const client = clients.get(name);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast message đến tất cả thành viên trong room
 */
function broadcastToRoom(roomId, message, excludeName = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  for (const name of room) {
    if (name !== excludeName) {
      sendTo(name, message);
    }
  }
}

/**
 * Gửi danh sách thành viên trong room cho tất cả thành viên
 */
function broadcastRoomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const members = Array.from(room);
  const message = {
    type: 'roomMembers',
    roomId,
    members
  };
  
  for (const name of room) {
    sendTo(name, message);
  }
}

/**
 * Xử lý khi client rời room
 */
function leaveRoom(name) {
  const client = clients.get(name);
  if (!client || !client.roomId) return;
  
  const roomId = client.roomId;
  const room = rooms.get(roomId);
  
  if (room) {
    room.delete(name);
    
    // Thông báo cho các thành viên còn lại
    broadcastToRoom(roomId, {
      type: 'memberLeft',
      roomId,
      name
    });
    
    // Cập nhật danh sách thành viên
    broadcastRoomMembers(roomId);
    
    // Xóa room nếu không còn ai
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`[Room] Phòng "${roomId}" đã bị xóa (không còn thành viên)`);
    }
  }
  
  client.roomId = null;
}

/**
 * Log với timestamp
 */
function log(category, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category}] ${message}`);
}

// ===== WebSocket Connection Handler =====
wss.on('connection', (ws) => {
  let clientName = null;
  
  log('WS', 'Client mới kết nối');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // ===== REGISTER =====
      if (data.type === 'register') {
        const name = String(data.name || '').trim();
        if (!name) {
          ws.send(JSON.stringify({ type: 'error', message: 'Tên không hợp lệ' }));
          return;
        }

        // Nếu trùng tên: kick phiên cũ
        if (clients.has(name)) {
          const oldClient = clients.get(name);
          leaveRoom(name);
          try { oldClient.ws.close(); } catch {}
          clients.delete(name);
          log('Register', `Kick phiên cũ của "${name}"`);
        }

        clientName = name;
        clients.set(clientName, { ws, roomId: null });
        
        ws.send(JSON.stringify({ 
          type: 'registered', 
          name: clientName,
          message: `Đăng ký thành công với tên "${clientName}"`
        }));
        
        log('Register', `"${clientName}" đã đăng ký`);
        return;
      }

      // Chưa register thì bỏ qua
      if (!clientName) {
        ws.send(JSON.stringify({ type: 'error', message: 'Bạn cần đăng ký trước' }));
        return;
      }

      // ===== CREATE ROOM =====
      if (data.type === 'createRoom') {
        const roomId = String(data.roomId || '').trim();
        if (!roomId) {
          sendTo(clientName, { type: 'error', message: 'Room ID không hợp lệ' });
          return;
        }
        
        // Rời room cũ nếu có
        leaveRoom(clientName);
        
        // Tạo room mới nếu chưa tồn tại
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
          log('Room', `Phòng "${roomId}" được tạo bởi "${clientName}"`);
        }
        
        // Thêm vào room
        rooms.get(roomId).add(clientName);
        clients.get(clientName).roomId = roomId;
        
        sendTo(clientName, {
          type: 'roomCreated',
          roomId,
          message: `Đã tạo/tham gia phòng "${roomId}"`
        });
        
        broadcastRoomMembers(roomId);
        log('Room', `"${clientName}" tham gia phòng "${roomId}"`);
        return;
      }

      // ===== JOIN ROOM =====
      if (data.type === 'joinRoom') {
        const roomId = String(data.roomId || '').trim();
        if (!roomId) {
          sendTo(clientName, { type: 'error', message: 'Room ID không hợp lệ' });
          return;
        }
        
        // Rời room cũ nếu có
        leaveRoom(clientName);
        
        // Tạo room nếu chưa tồn tại
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
          log('Room', `Phòng "${roomId}" được tạo tự động`);
        }
        
        // Thêm vào room
        rooms.get(roomId).add(clientName);
        clients.get(clientName).roomId = roomId;
        
        // Thông báo cho thành viên cũ về người mới
        broadcastToRoom(roomId, {
          type: 'memberJoined',
          roomId,
          name: clientName
        }, clientName);
        
        sendTo(clientName, {
          type: 'roomJoined',
          roomId,
          message: `Đã tham gia phòng "${roomId}"`
        });
        
        broadcastRoomMembers(roomId);
        log('Room', `"${clientName}" tham gia phòng "${roomId}"`);
        return;
      }

      // ===== LEAVE ROOM =====
      if (data.type === 'leaveRoom') {
        const roomId = clients.get(clientName)?.roomId;
        if (roomId) {
          log('Room', `"${clientName}" rời phòng "${roomId}"`);
          leaveRoom(clientName);
          sendTo(clientName, { type: 'roomLeft', message: 'Đã rời phòng' });
        }
        return;
      }

      // ===== START GROUP CALL =====
      if (data.type === 'startGroupCall') {
        const client = clients.get(clientName);
        if (!client || !client.roomId) {
          sendTo(clientName, { type: 'error', message: 'Bạn chưa vào phòng nào' });
          return;
        }
        
        const roomId = client.roomId;
        
        // Broadcast cho tất cả thành viên trong room
        broadcastToRoom(roomId, {
          type: 'groupCallStarted',
          roomId,
          initiator: clientName
        });
        
        log('Call', `"${clientName}" bắt đầu group call trong phòng "${roomId}"`);
        return;
      }

      // ===== OFFER (for group call) =====
      if (data.type === 'offer') {
        const { target, sender, offer, roomId } = data;
        
        if (!target || !sender || !offer) {
          sendTo(clientName, { type: 'error', message: 'Offer không hợp lệ' });
          return;
        }
        
        if (sender !== clientName) return; // Chống giả mạo
        
        sendTo(target, {
          type: 'offer',
          roomId,
          sender,
          target,
          offer
        });
        
        log('Signaling', `Offer: "${sender}" -> "${target}"`);
        return;
      }

      // ===== ANSWER =====
      if (data.type === 'answer') {
        const { target, sender, answer, roomId } = data;
        
        if (!target || !sender || !answer) return;
        if (sender !== clientName) return;
        
        sendTo(target, {
          type: 'answer',
          roomId,
          sender,
          target,
          answer
        });
        
        log('Signaling', `Answer: "${sender}" -> "${target}"`);
        return;
      }

      // ===== ICE CANDIDATE =====
      if (data.type === 'candidate') {
        const { target, sender, candidate, roomId } = data;
        
        if (!target || !sender || !candidate) return;
        if (sender !== clientName) return;
        
        sendTo(target, {
          type: 'candidate',
          roomId,
          sender,
          target,
          candidate
        });
        
        return;
      }

      // ===== END CALL =====
      if (data.type === 'endCall') {
        const client = clients.get(clientName);
        if (!client || !client.roomId) return;
        
        const roomId = client.roomId;
        
        // Thông báo cho tất cả trong room rằng người này đã dừng call
        broadcastToRoom(roomId, {
          type: 'peerEndedCall',
          roomId,
          name: clientName
        }, clientName);
        
        log('Call', `"${clientName}" kết thúc cuộc gọi trong phòng "${roomId}"`);
        return;
      }

    } catch (error) {
      console.error('Lỗi xử lý tin nhắn:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Lỗi xử lý tin nhắn' }));
    }
  });

  ws.on('close', () => {
    if (clientName) {
      log('WS', `"${clientName}" ngắt kết nối`);
      leaveRoom(clientName);
      clients.delete(clientName);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// ===== API Endpoints =====
app.get('/api/rooms', (req, res) => {
  const roomList = [];
  for (const [roomId, members] of rooms) {
    roomList.push({
      roomId,
      memberCount: members.size,
      members: Array.from(members)
    });
  }
  res.json(roomList);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    rooms: rooms.size
  });
});

// ===== Start Server =====
server.listen(PORT, HOST, () => {
  log('Server', `Server đang chạy trên https://${HOST}:${PORT}`);
  log('Server', `Static files: ${path.join(__dirname, 'public')}`);
});
