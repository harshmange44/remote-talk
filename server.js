const path = require('path');
const express = require('express')
const http = require('http')
const moment = require('moment');
const socketio = require('socket.io');
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

let userList = {};
let rooms = {};
let socketroom = {};
let socketname = {};
let micSocket = {};
let videoSocket = {};
let roomBoard = {};

io.on('connect', socket => {

    socket.on("join room", (roomid, username) => {

        socket.join(roomid);
        socketroom[socket.id] = roomid;
        socketname[socket.id] = username;
        micSocket[socket.id] = 'on';
        videoSocket[socket.id] = 'on';

        let userObj = {};
        userObj[socket.id] = username;

        if (rooms[roomid] && rooms[roomid].length > 0) {
            rooms[roomid].push(socket.id);
            userList[roomid].push(userObj);
            
            socket.to(roomid).emit('message', `${username} joined the room.`, 'Remote Talk', moment().utcOffset("+05:30").format(
                "h:mm a"
            ));
            io.to(socket.id).emit('join room', rooms[roomid].filter(pid => pid != socket.id), socketname, micSocket, videoSocket);
        }
        else {
            rooms[roomid] = [socket.id];
            userList[roomid] = [userObj];
            io.to(socket.id).emit('join room', null, null, null, null);
        }

        io.to(roomid).emit('user count', rooms[roomid].length);
        io.to(socketroom[socket.id]).emit('user added to the list', socket.id, username);
        io.to(roomid).emit('update user list', userList[roomid]);

    });

    socket.on('action', msg => {
        if (msg == 'mute')
            micSocket[socket.id] = 'off';
        else if (msg == 'unmute')
            micSocket[socket.id] = 'on';
        else if (msg == 'videoon')
            videoSocket[socket.id] = 'on';
        else if (msg == 'videooff')
            videoSocket[socket.id] = 'off';

        socket.to(socketroom[socket.id]).emit('action', msg, socket.id);
    })

    socket.on('video-offer', (offer, sid) => {
        socket.to(sid).emit('video-offer', offer, socket.id, socketname[socket.id], micSocket[socket.id], videoSocket[socket.id]);
    })

    socket.on('video-answer', (answer, sid) => {
        socket.to(sid).emit('video-answer', answer, socket.id);
    })

    socket.on('new icecandidate', (candidate, sid) => {
        socket.to(sid).emit('new icecandidate', candidate, socket.id);
    })

    socket.on('message', (msg, username, roomid) => {
        io.to(roomid).emit('message', msg, username, moment().utcOffset("+05:30").format(
            "h:mm a"
        ));
    })

    socket.on('live-editor', (content, hostUserId, username, roomid) => {
        setTimeout(function() {
            io.to(roomid).emit('live-editor', content, hostUserId, username);
        }, 100);
    })

    socket.on('getCanvas', () => {
        if (roomBoard[socketroom[socket.id]])
            socket.emit('getCanvas', roomBoard[socketroom[socket.id]]);
    });

    socket.on('draw', (newx, newy, prevx, prevy, color, size) => {
        socket.to(socketroom[socket.id]).emit('draw', newx, newy, prevx, prevy, color, size);
    })

    socket.on('clearBoard', () => {
        socket.to(socketroom[socket.id]).emit('clearBoard');
    });

    socket.on('store canvas', url => {
        roomBoard[socketroom[socket.id]] = url;
    })

    socket.on('disconnect', () => {
        if (!socketroom[socket.id]) return;
        socket.to(socketroom[socket.id]).emit('message', `${socketname[socket.id]} left the room.`, `Remote Talk`, moment().utcOffset("+05:30").format(
            "h:mm a"
        ));
        socket.to(socketroom[socket.id]).emit('remove peer', socket.id);
        var index = rooms[socketroom[socket.id]].indexOf(socket.id);
        rooms[socketroom[socket.id]].splice(index, 1);

        var userObjToRemove = {};

        userObjToRemove[socket.id] = socketname[socket.id];

        var indexForUserList = userList[socketroom[socket.id]].indexOf(userObjToRemove);
        userList[socketroom[socket.id]].splice(indexForUserList, 1);

        io.to(socketroom[socket.id]).emit('user count', rooms[socketroom[socket.id]].length);
        io.to(socketroom[socket.id]).emit('user removed from the list', socket.id, userObjToRemove[socket.id]);
        io.to(socketroom[socket.id]).emit('update user list', userList[socketroom[socket.id]]);

        delete socketroom[socket.id];

    });
})


server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));