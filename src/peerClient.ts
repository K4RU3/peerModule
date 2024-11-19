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
                    }
                }
            }
        }
    }

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
}

class PeerConnection{
    _conn: RTCPeerConnection;

    constructor(option: RTCConfiguration) {
        this._conn = new RTCPeerConnection(option);
    }

    set onopen(callback: () => void) {

    }

    set onmessage(callback: () => void) {

    }

    set onclose(callback: () => void) {

    }
}

