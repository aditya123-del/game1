const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express(); const server = http.createServer(app); const io = new Server(server);
const players = new Map(); const rooms = new Map(); const matchEnds = new Map(); const matchTimers = new Map(); const resetTimers = new Map(); const MATCH_MS = 5 * 60 * 1000;
const blockers = [[0,-48,95,2],[0,48,95,2],[-48,0,2,95],[48,0,2,95],[0,0,16,2],[-20,-18,2,14],[21,18,2,14],[-18,22,12,2],[20,-22,12,2],[-31,-30,10,2],[31,30,10,2],[-31,30,2,10],[31,-30,2,10],[-9,-31,2,10],[10,31,2,10],[10,-10,8,2],[-10,10,8,2]];
const blocked = (x,z) => blockers.some(b => Math.abs(x-b[0]) < b[2]/2+.65 && Math.abs(z-b[1]) < b[3]/2+.65);
app.use(express.static('public'));
function state(room) { return [...(rooms.get(room) || new Map()).values()]; }
function cleanName(value) { return String(value || 'Ranger').replace(/[^a-z0-9 _-]/gi, '').slice(0, 14) || 'Ranger'; }
function startMatch(room) {
  const endsAt = Date.now() + MATCH_MS;
  matchEnds.set(room, endsAt);
  clearTimeout(matchTimers.get(room));
  matchTimers.set(room, setTimeout(() => {
    const rankings = state(room).sort((a, b) => b.score - a.score);
    io.to(room).emit('gameOver', { winner: rankings[0] || null, rankings });
    resetTimers.set(room, setTimeout(() => {
      const playersInRoom = rooms.get(room); if (!playersInRoom?.size) return;
      playersInRoom.forEach(p => { p.score = 0; p.hp = 100; p.x = (Math.random() - .5) * 30; p.z = (Math.random() - .5) * 30; });
      startMatch(room);
      io.to(room).emit('matchReset', { endsAt: matchEnds.get(room), players: state(room) });
    }, 8000));
  }, MATCH_MS));
}
io.on('connection', socket => {
  socket.on('join', ({ room = 'lobby', name } = {}) => {
    room = String(room).replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'lobby';
    if (!rooms.has(room)) { rooms.set(room, new Map()); startMatch(room); }
    const player = { id: socket.id, name: cleanName(name), x: 0, z: 12, yaw: 0, hp: 100, score: 0, color: [0xff3b30, 0xff7a1a, 0xffc400][Math.floor(Math.random() * 3)] };
    players.set(socket.id, { room, player }); rooms.get(room).set(socket.id, player); socket.join(room);
    socket.emit('welcome', { id: socket.id, players: state(room), endsAt: matchEnds.get(room) }); socket.to(room).emit('playerJoined', player);
  });
  socket.on('move', data => { const entry = players.get(socket.id); if (!entry || !data) return; const p = entry.player; const x = Math.max(-44, Math.min(44, Number(data.x) || 0)), z = Math.max(-44, Math.min(44, Number(data.z) || 0)); if (!blocked(x,z)) { p.x=x; p.z=z; } p.yaw = Number(data.yaw) || 0; socket.to(entry.room).emit('playerMoved', { id:p.id, x:p.x, z:p.z, yaw:p.yaw }); });
  socket.on('jump', () => { const entry = players.get(socket.id); if (entry && Date.now() < (matchEnds.get(entry.room) || 0)) socket.to(entry.room).emit('playerJumped', { id: socket.id }); });
  socket.on('shoot', ({ targetId } = {}) => { const entry = players.get(socket.id); if (!entry || Date.now() >= (matchEnds.get(entry.room) || 0)) return; const target = rooms.get(entry.room)?.get(targetId); if (!target || target.hp <= 0) return; const dx = target.x - entry.player.x, dz = target.z - entry.player.z; if (dx * dx + dz * dz > 900) return; target.hp = Math.max(0, target.hp - 25); io.to(entry.room).emit('hit', { targetId, hp:target.hp, by:entry.player.name }); if (!target.hp) { entry.player.score += 100; io.to(entry.room).emit('score', { id:entry.player.id, score:entry.player.score }); io.to(entry.room).emit('kill', { killer:entry.player.name, victim:target.name }); setTimeout(() => { if (!rooms.get(entry.room)?.has(targetId)) return; target.hp=100; target.x=(Math.random()-.5)*30; target.z=(Math.random()-.5)*30; io.to(entry.room).emit('respawn', target); }, 1800); }
  });
  socket.on('disconnect', () => { const entry=players.get(socket.id); if (!entry) return; rooms.get(entry.room)?.delete(socket.id); if (!rooms.get(entry.room)?.size) { rooms.delete(entry.room); clearTimeout(matchTimers.get(entry.room)); matchTimers.delete(entry.room); clearTimeout(resetTimers.get(entry.room)); resetTimers.delete(entry.room); matchEnds.delete(entry.room); } players.delete(socket.id); socket.to(entry.room).emit('playerLeft', socket.id); });
});
server.listen(process.env.PORT || 3002, () => console.log('Arena Blaster running on port ' + (process.env.PORT || 3002)));