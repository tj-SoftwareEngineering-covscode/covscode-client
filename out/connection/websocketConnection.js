"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const ws_1 = require("ws");
const vscode = __importStar(require("vscode"));
class WebSocketConnection extends events_1.EventEmitter {
    websocket;
    serverAddress;
    websocketPath;
    connectingPromise;
    get readyState() {
        return this.websocket.readyState ?? ws_1.WebSocket.CLOSED;
    }
    constructor(serverAddress, websocketPath) {
        super();
        this.serverAddress = serverAddress;
        this.websocketPath = websocketPath;
    }
    //测试连接
    static async checkWebSocketConnection(serverAddress) {
        try {
            const socket = new ws_1.WebSocket(serverAddress);
            const connectPromise = new Promise((resolve, reject) => {
                socket.onopen = () => resolve();
                socket.onerror = () => reject();
            });
            await connectPromise;
            socket.close();
            vscode.window.showInformationMessage('连接到服务器');
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage('无法连接到服务器');
            return false;
        }
    }
    //连接websocket
    async connect() {
        if (this.readyState === ws_1.WebSocket.OPEN) {
            return;
        }
        if (this.readyState === ws_1.WebSocket.CONNECTING) {
            vscode.window.showInformationMessage('正在连接中');
            await this.connectingPromise;
            return;
        }
        if (this.readyState === ws_1.WebSocket.CLOSING) {
            vscode.window.showInformationMessage('正在关闭连接');
            return;
        }
        this.connectingPromise = new Promise((res, rej) => {
            this.websocket = new ws_1.WebSocket(`${this.serverAddress}/${this.websocketPath}`);
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
    onMessage = (e) => {
        this.emit('message', e.data);
    };
    onError = (ev) => this.emit('error', ev);
    onClose = (ev) => this.emit('close', ev);
}
exports.default = WebSocketConnection;
//# sourceMappingURL=websocketConnection.js.map