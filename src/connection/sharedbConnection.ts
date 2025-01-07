import { Connection } from 'sharedb/lib/client';  // 引入ShareDB的Connection类，用于与服务器建立共享文档连接
import { Socket } from 'sharedb/lib/sharedb';  // 引入ShareDB的Socket接口，用于定义与服务器通信的套接字
import ReconnectingWebSocket from 'reconnecting-websocket';  // 引入ReconnectingWebSocket类，用于创建自动重连的WebSocket连接
import { WebSocket } from 'ws';  // 引入WebSocket类，用于底层的WebSocket通信
import { EventEmitter } from 'events';  // 引入EventEmitter类，用于事件驱动编程
import { ClientFile } from '../entity/clientFile';  // 引入ClientFile类，表示客户端文件实体
import { FileOpenAction } from '../action/file/fileOpenAction';  // 引入FileOpenAction类，表示文件打开动作
import { DocManager } from '../manager/docManager';  // 引入DocManager类，用于管理文档
import { ClientRepo } from '../entity/clientRepo';  // 引入ClientRepo类，表示客户端仓库实体
 
export class SharedbConnection extends EventEmitter {
    // 声明自动重连的WebSocket连接
    private reconnectingWebSocket!: ReconnectingWebSocket;
    // 声明ShareDB的连接实例
    private sharedb!: Connection;
    // 声明服务器的地址
    private serverAddress!: string;
    // 声明ShareDB的路径
    private sharedbPath!: string;
    // 声明一个Promise，用于等待连接完成
    private connectingPromise?: Promise<void>;
 
    // 获取当前连接的readyState属性，如果WebSocket未初始化，则默认返回CLOSED状态
    get readyState() {
        return this.reconnectingWebSocket?.readyState ?? WebSocket.CLOSED;
    }
 
    // 构造函数，初始化服务器地址和ShareDB路径
    constructor(serverAddress: string) {
        super();
        this.serverAddress = serverAddress;
        this.sharedbPath = 'sharedb';
    }
 
    // 连接到ShareDB服务器
    public async connect() {
        // 如果已经连接成功，则直接返回
        if (this.readyState === WebSocket.OPEN) {
            return;
        }
        // 如果正在连接中，则等待连接完成
        if (this.readyState === WebSocket.CONNECTING) {
            await this.connectingPromise;
            return;
        }
        // 如果正在关闭中，则不进行连接操作
        if (this.readyState === WebSocket.CLOSING) {
            return;
        }
 
        // 初始化连接Promise，并创建ReconnectingWebSocket连接
        this.connectingPromise = new Promise<void>((res, rej) => {
            this.reconnectingWebSocket = new ReconnectingWebSocket(`${this.serverAddress}/${this.sharedbPath}`, [], {
                WebSocket: WebSocket,
                maxEnqueuedMessages: 0  // 不在队列中存储未发送的消息，直接丢弃
            });
 
            // 当连接打开时，初始化ShareDB连接，并解析Promise
            this.reconnectingWebSocket.addEventListener('open', () => {
                // 此处断言ReconnectingWebSocket实例为Socket类型，用于创建ShareDB连接
                // 注意：这种断言可能会绕过类型检查，使用时需谨慎
                this.sharedb = new Connection(this.reconnectingWebSocket as unknown as Socket);
                res();
            });
        });
 
        // 等待连接完成
        await this.connectingPromise;
    }
 
    // 创建一个文件文档
    public async createFileDoc(clientFile: ClientFile, fileOpenAction: FileOpenAction) {
        // 通过ShareDB获取文档实例
        let doc = this.sharedb.get(clientFile.getClientRepo().getRepoId()!, fileOpenAction.path!);
 
        // 尝试获取文档内容
        doc.fetch((err) => {
            if (err) {
                console.error("获取文档失败:", err);
            } else {
                // 如果文档类型为空，则表示文档不存在，需要创建
                if (doc.type === null) {
                    doc.create({ content: clientFile.getFileContent() }, (err) => {
                        if (err) {
                            console.error("创建文档失败:", err);
                        } else {
                            console.log("文档已创建");
                        }
                    });
                } else {
                    console.log("文档已存在");
                }
            }
        });
 
        // 订阅文档更新事件
        doc.subscribe(async (err) => {
            if (err) {
                throw err;
            }
            const docContent = doc.data.content;
            await clientFile.onWrite(docContent);
        });
 
        // 监听文档的op batch事件，用于处理文档内容的变更
        doc.on("op batch", async (op, source) => {
            // 判断操作来源是否为当前用户
            if (source === clientFile.getClientRepo().getUserId()) {
                const newContent = doc.data.content;
                DocManager.setLastVersion(doc);
                // 如果内容发生变化，则更新文件内容
                if (newContent !== clientFile.getFileContent()) {
                    clientFile.setVersionMap(DocManager.getLastVersion(doc)!, false);
                    await clientFile.onWrite(newContent);
                    console.log("已同步一个内容编辑操作，时间为", new Date().getTime());
                }
            } else {
                // 如果内容发生变化，则同步更新文件内容
                if (doc.data.content !== clientFile.getFileContent()) {
                    await clientFile.onWrite(doc.data.content);
                    console.log("已同步一个内容编辑操作，时间为", new Date().getTime());
                }
            }
        });
 
        return doc;
    }
 
    // 创建一个光标文档，用于跟踪用户的光标位置
    public createCursorDoc(clientRepo: ClientRepo) {
        // 通过ShareDB获取光标文档实例
        let doc = this.sharedb.get(clientRepo.getRepoId()!, "cursor");
 
        // 尝试获取光标文档内容
        doc.fetch((err) => {
            if (err) {
                console.error("获取光标文档失败:", err);
            } else {
                // 如果文档类型为空，则表示文档不存在，需要创建
                if (doc.type === null) {
                    doc.create({ cursor: {} }, (err) => {
                        if (err) {
                            console.error("创建文档失败:", err);
                        } else {
                            console.log("光标文档已创建");
                        }
                    });
                }
            }
        });
 
        // 订阅光标文档更新事件
        doc.subscribe(async (err) => {
            if (err) {
                throw err;
            }
            const docContent = doc.data.cursor;
            clientRepo.setCursorData(docContent);
        });
 
        // 监听光标文档的op batch事件，用于处理光标位置的变更
        doc.on("op batch", async (op, source) => {
            // 忽略未指定来源的操作（可能是系统内部操作）
            if (!source) {
                console.log("收到光标doc");
                const docContent = doc.data.cursor;
                clientRepo.setCursorData(docContent);
            }
        });
 
        return doc;
    }
 
    // 关闭连接
    public close() {
        this.reconnectingWebSocket.close();
    }
}