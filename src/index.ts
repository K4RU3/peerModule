import exrpess, { Express } from 'express';
import ws, { WebSocket } from 'ws';
import http from 'http';

const socketMap: Map<string, WebSocket[]> = new Map();

export function enablePeerModule(server: http.Server, { destroySocket: boolean } = { destroySocket: false }) {
	const wss = new ws.Server({ noServer: true });
	wss.on('connection', (ws: WebSocket) => {
		ws.on('message', function (msg) {
		});
	});
}

