import ws, { WebSocket } from 'ws';
import http from 'http';

const socketMap: Map<string, { sockets: [WebSocket?, WebSocket?], state: 'waiting' | 'offer' | 'answer' | 'connection' }> = new Map();
const connectionMap: Map<WebSocket, string[]> = new Map();

export default function enablePeerModule(server: http.Server, path: string, option: { destroySocket: boolean } = { destroySocket: false }) {
	const wss = new ws.Server({ noServer: true });
	wss.on('connection', (ws: WebSocket) => {
        ws.send(createMessage('success', 'connected peer server', ""));
		ws.on('message', function (msg) {
            try{
                const { type, id, data } = JSON.parse(msg.toString());
                if(typeof id !== 'string' || id.length === 0) return ws.send(createMessage('error', 'id not found', ""))
                const pair = socketMap.get(id);
                switch(type){
                    case "join":
                        let result = addSocket(ws, id);
                        switch(result) {
                            case -1: ws.send(createMessage('error', 'undefined id', id)); break;
                            case 0: ws.send(createMessage('error', 'room is full', id)); break;
                            case 1: ws.send(createMessage('success', 'waiting other', id)); break;
                            case 2: ws.send(createMessage('success', 'connection started', id)); break;
                        }
                        break;

                    case "offer":
                        if(!pair) return ws.send(createMessage('error', 'undefined id', id));
                        if(pair.state !== 'offer') return ws.send(createMessage('error', 'no waiting offer', id));
                        if(pair.sockets[0] !== ws) return ws.send(createMessage('error', 'permission denied', id));
                        if(!data || typeof data !== 'object') return ws.send(createMessage('error', 'invalid offer', id));
                        pair.state = 'answer';
                        pair.sockets[1]?.send(createMessage('request answer', data, id));
                        ws.send(createMessage('success', null, id));
                        break;

                    case 'answer':
                        if(!pair) return ws.send(createMessage('error', 'undefined id', id));
                        if(pair.state !== 'answer') return ws.send(createMessage('error', 'no waiting answer', id));
                        if(pair.sockets[1] !== ws) return ws.send(createMessage('error', 'permission denied', id));
                        if(!data || typeof data !== 'object') return ws.send(createMessage('error', 'invalid answer', id));
                        pair.state = 'connection';
                        pair.sockets[0]?.send(createMessage('sdp answer', data, id));
                        ws.send(createMessage('success', null, id));
                        break;

                    case 'icecandidate':
                        if(!pair) return ws.send(createMessage('error', 'undefined id', id));
                        const socketIndex = pair.sockets.findIndex(socket => socket === ws);
                        if(pair.state !== 'offer' && pair.state !== 'answer' && pair.state !== 'connection') return ws.send(createMessage('error', 'no waiting candidate', id));
                        if(socketIndex === -1) return ws.send(createMessage('error', 'permission denied', id));
                        pair.sockets[(socketIndex+1)%2]?.send(createMessage('icecandidate', data, id));
                        ws.send(createMessage('success', null, id));
                        break;

                    case 'disconnect':
                        if(!pair) return ws.send(createMessage('error', 'undefined id', id));
                        pair.sockets.splice(pair.sockets.findIndex(socket => socket === ws), 1);
                        pair.state = 'waiting';
                        if(pair.sockets.length === 0) socketMap.delete(id);
                        break;
                }
            }catch(e){
                console.error(e);
                ws.send(createMessage('error', 'invalid message', ""));
            }
		});

        ws.on('close', () => {
            const ids = connectionMap.get(ws);
            if(ids){
                ids.forEach(id => {
                    const pair = socketMap.get(id);
                    if(pair){
                        pair.sockets.splice(pair.sockets.findIndex(socket => socket === ws), 1);
                        pair.state = 'waiting';
                        if(pair.sockets.length === 0) socketMap.delete(id);
                    }
                });
            }
            connectionMap.delete(ws);
        })
	});

    server.on('upgrade', (req, socket, head) => {
        if(req.url === path){
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req);
            })
        }else if(option.destroySocket){
            socket.destroy();
        }
    })
}

function addSocket(socket: WebSocket, id: string): -1|0|1|2 {
    const pair = socketMap.get(id);
    if(pair){
        switch(pair.sockets.length){
            case 1:
                pair.state = 'offer';
                pair.sockets[0]?.send(createMessage('request offer', null, id));
            case 0:
                pair.sockets.push(socket);
                const connections = connectionMap.get(socket);
                if(connections) connections.push(id);
                else connectionMap.set(socket, [id]);
                return pair.sockets.length;
            default:
                return 0;
        }
    }else{
        socketMap.set(id, { sockets: [socket], state: 'waiting' });
        const connections = connectionMap.get(socket);
        if(connections) connections.push(id);
        else connectionMap.set(socket, [id]);
        return 1;
    }
}

type MessageType = 'error' | 'success' | 'request offer' | 'request answer' | 'sdp answer' | 'icecandidate';
type MessageBody = 'undefined id' | 'id not found' | 'room is full' | 'waiting other' |'connection started' |
                   'no waiting offer' | 'no waiting answer' | 'no waiting candidate' | 'permission denied' |
                    null| object |
                   'invalid offer' | 'invalid answer'|
                   'connected peer server' | 'invalid message';
function createMessage(type: MessageType, body: MessageBody, id: string) {
    return JSON.stringify({ type, message: body, id });
}
