import { EventEmitter } from 'events';
import { WebSocket, MessageEvent, ErrorEvent, CloseEvent } from 'ws';
import * as vscode from 'vscode';

export default class WebSocketConnection extends EventEmitter {
    private websocket!: WebSocket;
    private serverAddress: string;
    private websocketPath: string;
    private connectingPromise?: Promise<void>;

    get readyState(){
        return this.websocket.readyState ?? WebSocket.CLOSED;
    }

    constructor(serverAddress: string, websocketPath: string) {
        super();
        this.serverAddress = serverAddress;
        this.websocketPath = websocketPath;
    }

    //测试连接
    public static async checkWebSocketConnection(serverAddress: string): Promise<boolean> {
        try {
            const socket = new WebSocket(serverAddress);
            
            const connectPromise = new Promise<void>((resolve, reject) => {
                socket.onopen = () => resolve();
                socket.onerror = () => reject();
            });
            
            await connectPromise;
            socket.close();
            vscode.window.showInformationMessage('连接到服务器');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage('无法连接到服务器');
            return false;
        }
    }

    //连接websocket
    public async connect(){
        if(this.readyState === WebSocket.OPEN){
            return;
        }
        if(this.readyState === WebSocket.CONNECTING){
            vscode.window.showInformationMessage('正在连接中');
            await this.connectingPromise;
            return;
        }
        if(this.readyState === WebSocket.CLOSING){
            vscode.window.showInformationMessage('正在关闭连接');
            return;
        }

        this.connectingPromise = new Promise<void>((res, rej) => {
            this.websocket = new WebSocket(`${this.serverAddress}/${this.websocketPath}`);

            this.websocket.addEventListener('error', ev => {
                rej();
                this.websocket.removeAllListeners();
            });
        
            this.websocket.addEventListener('close', ev => {
                rej();
                this.websocket.removeAllListeners();
            });
        
            this.websocket.addEventListener('open', () => {
                res();
                this.websocket.removeAllListeners();
                this.websocket.addEventListener('message', this.onMessage);
                this.websocket.addEventListener('close', this.onClose);
                this.websocket.addEventListener('error', this.onError);
                this.connectingPromise = undefined;
            });
        });

        await this.connectingPromise;
    }

    //三种连接后的回调
    private onMessage = (e: MessageEvent) => {
        this.emit('message', e.data);
    };
    
    private onError = (ev: ErrorEvent) => this.emit('error', ev);
    
    private onClose = (ev: CloseEvent) => this.emit('close', ev);
}