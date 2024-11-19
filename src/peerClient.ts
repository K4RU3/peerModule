class PeerClient{
    _ws: WebSocket;
    constructor(url: string){
        this._ws = new WebSocket(url);
    }
}
