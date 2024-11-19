class PeerClient{
    _ws: WebSocket;
    _opend: boolean = false;
    constructor(url: string){
        this._ws = new WebSocket(url);
    }
}
