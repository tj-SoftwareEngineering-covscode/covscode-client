import { Connection } from 'sharedb/lib/client'
import { Socket } from 'sharedb/lib/sharedb';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export class SharedbConnection extends EventEmitter{
    private reconnectingWebSocket!:ReconnectingWebSocket;
    private sharedb!:Connection;
    private serverAddress!:string;
    private sharedbPath!:string;
    private connectingPromise?:Promise<void>;

    get readyState(){
        return this.reconnectingWebSocket.readyState??WebSocket.CLOSED;
    }


    constructor(serverAddress:string){
        super();
        this.serverAddress = serverAddress;
        this.sharedbPath='sharedb';
    }
    
    public async connect(){
        if (this.readyState === WebSocket.OPEN) {
            return;
        }
        if (this.readyState === WebSocket.CONNECTING) {
            await this.connectingPromise;
            return;
        }
        if (this.readyState === WebSocket.CLOSING) {
            return;
        }

        this.connectingPromise = new Promise<void>((res, rej) => {
            this.reconnectingWebSocket = new ReconnectingWebSocket(`${this.serverAddress}/${this.sharedbPath}`, [], {
                WebSocket: WebSocket,
                maxEnqueuedMessages: 0
            });
            this.reconnectingWebSocket.addEventListener('open', () => {
                //此处使用了断言绕开类型验证，后续需要检验这种Connection的新建在ts里是否可行
                this.sharedb = new Connection(this.reconnectingWebSocket as unknown as Socket);
                res();
            });
        });
        await this.connectingPromise;
    }
}