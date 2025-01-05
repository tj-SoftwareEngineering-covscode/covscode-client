import { EventEmitter } from 'events';
import { WebSocket, MessageEvent, ErrorEvent, CloseEvent } from 'ws';
import * as vscode from 'vscode';
import { BaseAction } from '../action/baseAction';
import { WebSocketMessage } from '../message/websocketMessage';
import { BaseMessage } from '../message/baseMessage';

export class WebSocketConnection extends EventEmitter {
    private websocket!: WebSocket;
    private serverAddress: string;
    private websocketPath: string;
    private connectingPromise?: Promise<void>;
    private closePromise?: Promise<void>;

    get readyState(){
        return this.websocket?.readyState ?? WebSocket.CLOSED;
    }

    constructor(serverAddress: string) {
        super();
        this.serverAddress = serverAddress;
        this.websocketPath = 'websocket';
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
            console.log(`${this.serverAddress}/${this.websocketPath}`);

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

    //关闭连接
    public async close(){
        if(this.readyState === WebSocket.CLOSED){
            return;
        }
        if(this.readyState === WebSocket.CLOSING){
            await this.closePromise;
            return;
        }
        if(this.readyState === WebSocket.CONNECTING){
            return;
        }

        this.closePromise = new Promise<void>((res, rej) => {
            this.websocket.removeAllListeners();
            this.websocket.addEventListener("close", () => {
                res();
                this.websocket.removeAllListeners();
            });
            this.websocket.addEventListener("error", (ev) => {
                rej(new Error(`${ev.type}: ${ev.message}`));
                this.websocket.removeAllListeners();
            });
            this.websocket.close();
        });
        await this.closePromise;
    }

    //三种连接后的回调
    private onMessage = (me: MessageEvent) => {
        const messageData = JSON.parse(me.data as string);
        this.emit('message', messageData);
    };
    
    private onError = (ee: ErrorEvent) => this.emit('error', ee);
    
    private onClose = (ce: CloseEvent) => this.emit('close', ce);

    //发送数据
    public async sendData(data:BaseAction|BaseMessage){
        if (this.readyState !== WebSocket.OPEN) {
            this.emit('error','connection is NOT OPEN');
            return;
        }

        if(data instanceof BaseAction){
            this.websocket.send(JSON.stringify(new WebSocketMessage(data, true)));
        }else{
            this.websocket.send(JSON.stringify(data));
        }
    }
}