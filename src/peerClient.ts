type MessageType = 'error' | 'success' | 'request offer' | 'request answer' | 'sdp answer' | 'icecandidate';
type MessageBody =
    | 'undefined id'
    | 'id not found'
    | 'room is full'
    | 'waiting other'
    | 'connection started'
    | 'no waiting offer'
    | 'no waiting answer'
    | 'no waiting candidate'
    | 'permission denied'
    |  null
    |  object
    | 'invalid offer'
    | 'invalid answer'
    | 'connected peer server';

type JsonMessage = { type: MessageType, message: MessageBody, id: string };

class PeerClient{
    _ws: WebSocket;
    _opend: boolean = false;
    _onMessageList: ((msg: MessageEvent) => void)[] = [];
    constructor(url: string){
        this._ws = new WebSocket(url);
        this._ws.onopen = () => {
            this._ws.onmessage = (msg) => {
                const parsed = JSON.parse(msg.data);
                if(this.isValidJsonObject(parsed)){
                    const { type, message } = parsed;
                    if(type === 'success' && message === 'connected peer server') {
                        this._opend = true;
                        this._ws.onopen = null;
                        this._ws.onmessage = (msg) => {
                            if(!this.isValidJsonObject(JSON.parse(msg.data))) throw new Error("Invalid Message from Server.");
                            this._onMessageList.forEach(cb => cb(msg));
                        }
                    }
                }
            }
        }
    }

    async matchmake(matchmakeId: string, option?: RTCConfiguration): Promise<PeerConnection> {
        return new Promise(async (resolve, reject) => {
            if(!this._opend) throw new Error("not connected to peer server");
            if(!matchmakeId || typeof matchmakeId !== 'string') throw new Error("invalid id. id must be string at least 1 character");
            let status = 'waiting';
            const peer = new RTCPeerConnection()
            const dataChannel = peer.createDataChannel('data');
            peer.onicecandidate = (event) => {
                if(event.candidate) {
                    this._ws.send(JSON.stringify({
                        id: matchmakeId,
                        type: 'icecandidate',
                        candidate: event.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                    }))
                }
            }
            this._ws.send(JSON.stringify({
                type: "join",
                id: matchmakeId
            }))
            const cb = (msg: MessageEvent) => {
                const parsed = JSON.parse(msg.data) as JsonMessage;
                const { type, id, message } = parsed;
                if(matchmakeId === id) {
                    if(type === 'icecandidate') {
                        peer.addIceCandidate(new RTCIceCandidate(message as RTCIceCandidateInit)).then(() => {
                            if(peer.connectionState === 'connected') {
                                resolve(new PeerConnection(dataChannel));
                            }
                        })
                    }
                    switch(status){
                        case 'waiting':
                            if(type === 'error') {
                                if(message === 'undefined id') {
                                    reject(new Error(message));
                                }else if(message === 'room is full') {
                                    reject(new Error("is id unset? matchmake must id"));
                                }
                            }else if(type === 'success'){
                                if(message === 'connection started') {
                                    status = 'offer';
                                }
                            }else if(type === 'request offer') {
                                peer.createOffer().then(offer => {
                                    peer.setLocalDescription(offer).then(() => {
                                        this._ws.send(JSON.stringify({
                                            type: 'offer',
                                            id: matchmakeId,
                                            data: offer
                                        }))
                                        status = 'answer';
                                    })
                                });
                            }
                            break;
                        case 'offer':
                            if(type === 'request answer'){
                                peer.setRemoteDescription(new RTCSessionDescription(message as RTCSessionDescriptionInit)).then(() => {
                                    peer.createAnswer().then(answer => {
                                        peer.setLocalDescription(answer).then(() => {
                                            this._ws.send(JSON.stringify({
                                                type: 'answer',
                                                id: matchmakeId,
                                                data: answer
                                            }))
                                            status = 'answer';
                                        })
                                    })
                                })
                            }
                            break;
                        case 'answer':
                            if(type === 'sdp answer'){
                                peer.setRemoteDescription(new RTCSessionDescription(message as RTCSessionDescriptionInit)).then(() => {
                                    status = 'connection'
                                    if(peer.connectionState === 'connected') {
                                        resolve(new PeerConnection(dataChannel));
                                    }
                                })
                            }else if(type === 'success'){
                                if(peer.connectionState === 'connected') {
                                    resolve(new PeerConnection(dataChannel));
                                }
                            }
                        default: break;
                    }
                }
            }
            this.addOnMessage(cb);
        })
    }

    //private methods field
    private isValidJsonObject(obj: any): boolean {
        return (typeof obj === 'object' &&
                obj !== null &&
                typeof obj.type === 'string' &&
                this.includesType(obj.type) &&
                ((typeof obj.message === 'string' && this.includesMessage(obj.message)) || (typeof obj.message === 'object')) &&
                typeof obj.id === 'string'
               )

    }

    private includesType(type: any): boolean {
        return typeof type === 'string' && ['error' , 'success' , 'request offer' , 'request answer' , 'sdp answer' , 'icecandidate'].includes(type)
    }

    private includesMessage(message: any): boolean {
        return typeof message === 'string' && ['undefined id' , 'id not found' , 'room is full' , 'waiting other' ,'connection started' ,
                   'no waiting offer' , 'no waiting answer' , 'no waiting candidate' , 'permission denied' ,
                    null, 
                   'invalid offer' , 'invalid answer',
                   'connected peer server'].includes(message)
    }

    private addOnMessage(callback: (msg: MessageEvent) => void){
        if(typeof callback === 'function') this._onMessageList.push(callback);
    }
    private removeOnMessage(callback: (msg: MessageEvent) => void){
        if(typeof callback === 'function') this._onMessageList = this._onMessageList.filter(cb => cb !== callback);
    }
}

class PeerConnection {
    _channel: RTCDataChannel;
    constructor(channel: RTCDataChannel){
        this._channel = channel
    }

    get testGetChannel() { return this._channel; }
    
    get testGetPeer() { return this._channel; }
}
