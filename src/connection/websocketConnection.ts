import { EventEmitter } from 'events'; // 引入Node.js的事件发射器，用于处理事件
import { WebSocket, MessageEvent, ErrorEvent, CloseEvent } from 'ws'; // 引入WebSocket库，用于处理WebSocket连接
import * as vscode from 'vscode'; // 引入VSCode扩展API，用于与VSCode交互
import { BaseAction } from '../action/baseAction'; // 引入基础动作类，用于发送动作数据
import { WebSocketMessage } from '../message/websocketMessage'; // 引入WebSocket消息封装类，用于封装消息数据
import { BaseMessage } from '../message/baseMessage'; // 引入基础消息类，用于发送普通消息数据
 
/**
 * WebSocket连接管理类
 * 用于管理WebSocket连接的建立、关闭、消息发送与接收
 */
export class WebSocketConnection extends EventEmitter {
    // WebSocket实例
    private websocket!: WebSocket;
    // 服务器地址
    private serverAddress: string;
    // WebSocket路径
    private websocketPath: string;
    // 连接过程中的Promise，用于处理连接中的等待
    private connectingPromise?: Promise<void>;
    // 关闭过程中的Promise，用于处理关闭中的等待
    private closePromise?: Promise<void>;
 
    /**
     * 获取WebSocket的当前状态
     */
    get readyState() {
        return this.websocket?.readyState ?? WebSocket.CLOSED; // 若websocket未定义，则返回CLOSED状态
    }
 
    /**
     * 构造函数
     * @param serverAddress 服务器地址
     */
    constructor(serverAddress: string) {
        super(); // 调用父类构造函数
        this.serverAddress = serverAddress; // 设置服务器地址
        this.websocketPath = 'websocket'; // 设置WebSocket路径
    }
 
    /**
     * 测试WebSocket连接
     * @param serverAddress 服务器地址
     * @returns 连接成功返回true，失败返回false
     */
    public static async checkWebSocketConnection(serverAddress: string): Promise<boolean> {
        try {
            const socket = new WebSocket(serverAddress); // 创建WebSocket实例
            
            const connectPromise = new Promise<void>((resolve, reject) => {
                socket.onopen = () => resolve(); // 连接成功时解决Promise
                socket.onerror = () => reject(); // 连接出错时拒绝Promise
            });
            
            await connectPromise; // 等待连接成功
            socket.close(); // 连接成功后关闭连接
            vscode.window.showInformationMessage('连接到服务器'); // 提示连接成功
            return true; // 返回连接成功
        } catch (error) {
            vscode.window.showErrorMessage('无法连接到服务器'); // 提示连接失败
            return false; // 返回连接失败
        }
    }
 
    /**
     * 连接WebSocket
     */
    public async connect() {
        // 根据当前状态处理连接逻辑
        if (this.readyState === WebSocket.OPEN) {
            return; // 已连接，直接返回
        }
        if (this.readyState === WebSocket.CONNECTING) {
            vscode.window.showInformationMessage('正在连接中'); // 正在连接，提示用户并等待连接完成
            await this.connectingPromise; // 等待连接Promise完成
            return; // 连接完成后返回
        }
        if (this.readyState === WebSocket.CLOSING) {
            vscode.window.showInformationMessage('正在关闭连接'); // 正在关闭，提示用户并返回
            return; // 不进行连接操作
        }
 
        // 开始新的连接过程
        this.connectingPromise = new Promise<void>((res, rej) => {
            this.websocket = new WebSocket(`${this.serverAddress}/${this.websocketPath}`); // 创建WebSocket实例并连接到服务器
            console.log(`${this.serverAddress}/${this.websocketPath}`); // 打印连接地址
 
            // 处理连接错误事件
            this.websocket.addEventListener('error', ev => {
                rej(); // 连接错误时拒绝Promise
                this.websocket.removeAllListeners(); // 移除所有监听器
            });
        
            // 处理连接关闭事件
            this.websocket.addEventListener('close', ev => {
                rej(); // 连接关闭时拒绝Promise
                this.websocket.removeAllListeners(); // 移除所有监听器
            });
        
            // 处理连接成功事件
            this.websocket.addEventListener('open', () => {
                res(); // 连接成功时解决Promise
                this.websocket.removeAllListeners(); // 移除所有监听器（连接成功后不再需要临时监听器）
                // 添加永久监听器
                this.websocket.addEventListener('message', this.onMessage); // 消息接收事件
                this.websocket.addEventListener('close', this.onClose); // 连接关闭事件
                this.websocket.addEventListener('error', this.onError); // 连接错误事件
                this.connectingPromise = undefined; // 重置连接Promise
            });
        });
 
        await this.connectingPromise; // 等待连接完成
    }
 
    /**
     * 关闭WebSocket连接
     */
    public async close() {
        // 根据当前状态处理关闭逻辑
        if (this.readyState === WebSocket.CLOSED) {
            return; // 已关闭，直接返回
        }
        if (this.readyState === WebSocket.CLOSING) {
            await this.closePromise; // 正在关闭，等待关闭Promise完成
            return; // 关闭完成后返回
        }
        if (this.readyState === WebSocket.CONNECTING) {
            return; // 正在连接，不进行关闭操作
        }
 
        // 开始新的关闭过程
        this.closePromise = new Promise<void>((res, rej) => {
            this.websocket.removeAllListeners(); // 移除所有监听器（避免关闭过程中的事件干扰）
            // 处理连接关闭事件
            this.websocket.addEventListener("close", () => {
                res(); // 连接关闭时解决Promise
                this.websocket.removeAllListeners(); // 确保移除所有监听器
            });
            // 处理连接错误事件
            this.websocket.addEventListener("error", (ev) => {
                rej(new Error(`${ev.type}: ${ev.message}`)); // 连接错误时拒绝Promise并抛出错误信息
                this.websocket.removeAllListeners(); // 确保移除所有监听器
            });
            this.websocket.close(); // 关闭连接
        });
        await this.closePromise; // 等待关闭完成
    }
 
    /**
     * 处理接收到的消息事件
     * @param me 消息事件对象
     */
    private onMessage = (me: MessageEvent) => {
        const messageData = JSON.parse(me.data as string); // 解析消息数据
        console.log('接收'); // 打印接收标记
        console.log(messageData); // 打印消息数据
        this.emit('message', messageData); // 发射消息事件并传递消息数据
    };
    
    /**
     * 处理连接错误事件
     * @param ee 错误事件对象
     */
    private onError = (ee: ErrorEvent) => this.emit('error', ee); // 发射错误事件并传递错误对象
    
    /**
     * 处理连接关闭事件
     * @param ce 关闭事件对象
     */
    private onClose = (ce: CloseEvent) => this.emit('close', ce); // 发射关闭事件并传递关闭对象
 
    /**
     * 发送数据
     * @param data 要发送的数据（BaseAction或BaseMessage实例）
     */
    public async sendData(data: BaseAction | BaseMessage) {
        if (this.readyState !== WebSocket.OPEN) {
            this.emit('error', 'connection is NOT OPEN'); // 若连接未打开，则发射错误事件
            return; // 不进行发送操作
        }
 
        if (data instanceof BaseAction) {
            // 若数据为BaseAction实例，则进行封装后发送
            console.log(new WebSocketMessage(data, true)); // 打印封装后的消息数据（调试用）
            this.websocket.send(JSON.stringify(new WebSocketMessage(data, true))); // 发送封装后的消息数据
        } else {
            // 若数据为BaseMessage实例或其他类型，则直接发送
            console.log(data); // 打印消息数据（调试用）
            this.websocket.send(JSON.stringify(data)); // 发送消息数据
        }
    }
}