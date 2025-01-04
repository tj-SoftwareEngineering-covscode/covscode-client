import { Connection } from 'sharedb/lib/client'
import { Socket } from 'sharedb/lib/sharedb';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { ClientFile } from '../entity/clientFile';
import { FileOpenAction } from '../action/file/fileOpenAction';
import { DocManager } from '../manager/docManager';

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

    public createFileDoc(clientFile:ClientFile, fileOpenAction:FileOpenAction){
        let doc = this.sharedb.get(clientFile.getClientRepo().getRepoId()!, fileOpenAction.getPath()!);
        doc.fetch((err) => {
            if (err) {
                console.error("获取文档失败:", err);
            } else {
                if (doc.type === null) {
                    doc.create({ content: clientFile.getContent() }, (err) => {
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

        doc.subscribe(async (err) => {
            if (err) {
              throw err;
            }
            const docContent = doc.data.content;
            await clientFile.onWrite(docContent);
        });

        doc.on("op batch", async (op, source) => {
            let docInstance = DocManager.getDoc(clientFile);
      
            if (source == clientFile.getClientRepo().getUserId()) {
                console.log("收到op", op);
                console.log("doc 内容为", doc.data.content);
                const newContent = doc.data.content;
                DocManager.setLastVersion(doc);
                if (newContent !== clientFile.getFileContent()) {
                    clientFile.setVersionMap(DocManager.getLastVersion(doc)!, false);
                    await clientFile.onWrite(newContent);
                    console.log("已同步一个内容编辑操作，时间为", new Date().getTime());
                }
            } else {
                if (doc.data.content !== clientFile.getFileContent()) {
                    await clientFile.onWrite(doc.data.content);
                    console.log("已同步一个内容编辑操作，时间为", new Date().getTime());
                }
            }
        });
      
        return doc;
    }

    //光标doc创建待补全
}