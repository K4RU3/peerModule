import ws, { WebSocket } from 'ws';
import http from 'http';

type sdp = object|null;

const socketMap: Map<string, { offer: sdp, answer: sdp, sockets: [WebSocket?, WebSocket?] }> = new Map();

export function enablePeerModule(server: http.Server, path: string, option: { destroySocket: boolean } = { destroySocket: false }) {
	const wss = new ws.Server({ noServer: true });
	wss.on('connection', (ws: WebSocket) => {
		ws.on('message', function (msg) {
            const { type, id } = JSON.parse(msg.toString());
            const pair = socketMap.get(id);
            if(type === "join" && id !== "" && pair){
                const joined = addSocket(ws, id);
                if(joined){
                    //参加成功

                }
            }
		});
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

function addSocket(socket: WebSocket, id: string): boolean {
    const pair = socketMap.get(id);
    if(pair){
        switch(pair.sockets.length){
            case 1:
                pair.sockets[0]?.send(JSON.stringify({
                    type: 'reqest offer'
                }))
            case 0:
                pair.sockets.push(socket);
                return true;
            default:
                return false;
        }
    }
    return false;
}

