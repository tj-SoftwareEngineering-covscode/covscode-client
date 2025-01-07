import * as vscode from 'vscode';
import { RepoEditor } from '../editor/repoEditor';
import { WebSocketConnection } from '../connection/websocketConnection';
import { SharedbConnection } from '../connection/sharedbConnection';
import { ClientUser } from './clientUser';
import { UserInput } from '../extension';
import { SessionInitAction } from '../action/session/sessionInitAction';
import { SessionJoinAction } from '../action/session/sessionJoinAction';
import { SessionLeaveAction } from '../action/session/sessionLeaveAction';
import { NodeCreateAction } from '../action/file/nodeCreateAction';
import { NodeDeleteAction } from '../action/file/nodeDeleteAction';
import { NodeRenameAction } from '../action/file/nodeRenameAction';
import { FileCloseAction } from '../action/file/fileCloseAction';
import { FileOpenAction } from '../action/file/fileOpenAction';
import { BaseMessage } from '../message/baseMessage';
import { PendingPromise } from '../util/pendingPromise';
import { ErrorEvent, CloseEvent } from 'ws';
import { SiteIdMessage } from '../message/siteIdMessage';
import { ZippedDataMessage } from '../message/zippedDataMessage';
import { WebSocketMessage } from '../message/websocketMessage';
import { TextDocument, TextDocumentChangeEvent } from 'vscode';
import { Mutex } from 'async-mutex';
import { MessageType } from '../message/baseMessage';
import { ActionType } from '../action/baseAction';
import { FileEditor } from '../editor/fileEditor';
import { ClientFile } from './clientFile';
import { DocManager } from '../manager/docManager';
import { WorkspaceWatcher } from '../watcher/workspaceWatcher';

// 客户端仓库类，负责管理协同编辑的核心功能
// 包括用户管理、文件同步、光标同步等功能
export class ClientRepo {
    // 服务器WebSocket地址，用于建立实时连接
    private serverAddress: string;
    
    // 仓库编辑器实例，负责处理VSCode编辑器相关的所有操作
    private repoEditor: RepoEditor;
    
    // WebSocket连接实例，处理与服务器的实时消息通信
    private websocketConnection: WebSocketConnection;
    
    // ShareDB连接实例，处理文档的协同编辑功能
    private sharedbConnection: SharedbConnection;
    
    // 工作区监听器，监听本地文件系统的变化并同步到远程
    private workspaceWatcher: WorkspaceWatcher;
    
    // 当前用户的信息，包含用户ID、仓库ID和站点ID
    private user: ClientUser;
    
    // 所有在线用户的列表，用于管理协同编辑的参与者
    private users: ClientUser[] = [];
    
    // 文件映射表，key为文件路径，value为文件实例
    // 用于追踪所有打开的文件的状态
    private fileMap: Map<string, ClientFile> = new Map();
    
    // 用于等待服务器返回压缩的仓库数据的Promise
    private zippedDataPendingPromise?: PendingPromise;
    
    // 用于等待服务器分配的站点ID的Promise
    private siteIdPendingPromise?: PendingPromise;
    
    // 互斥锁，确保关键操作的线程安全
    private mutex: Mutex = new Mutex();

    // 构造函数，初始化仓库的所有必要组件
    constructor(userInput: UserInput, repoEditor: RepoEditor) {
        // 保存服务器地址
        this.serverAddress = userInput.serverAddress;

        // 初始化编辑器实例
        this.repoEditor = repoEditor;

        // 创建工作区监听器
        this.workspaceWatcher = new WorkspaceWatcher(this, this.repoEditor);

        // 创建WebSocket连接实例
        this.websocketConnection = new WebSocketConnection(this.serverAddress);

        // 创建ShareDB连接实例
        this.sharedbConnection = new SharedbConnection(this.serverAddress);

        // 创建用户实例
        this.user = new ClientUser();

        // 设置用户ID
        this.user.setUserId(userInput.userId);

        // 设置仓库ID
        this.user.setRepoId(userInput.repoId);

        // 设置WebSocket事件监听器
        this.setWebsocketListeners();
    }

    // 获取当前WebSocket连接状态
    // 用于UI展示和连接状态检查
    public get connectionStatus() {
        return this.websocketConnection.readyState;
    }

    // 获取当前仓库的ID
    public getRepoId() {
        return this.user.getRepoId();
    }

    // 获取当前用户的ID
    public getUserId() {
        return this.user.getUserId();
    }

    // 获取当前用户的站点ID，用于在协同编辑中唯一标识用户
    public getSiteId() {
        return this.user.getSiteId();
    }

    // 获取当前用户实例
    public getUser() {
        return this.user;
    }

    // 获取WebSocket连接实例
    public getWebsocketConnection() {
        return this.websocketConnection;
    }

    // 获取文件映射表
    public getFileMap() {
        return this.fileMap;
    }

    // 设置WebSocket事件监听器
    private setWebsocketListeners(){
        //进行绑定
        this.websocketConnection.on('message', this.onMessage);
        this.websocketConnection.on('error', this.onError);
        this.websocketConnection.on('close', this.onClose);
    }

    // 更新光标数据
    public setCursorData(cursorData: { [key: string]: any }) {
        for (var key in cursorData) {
            if (cursorData.hasOwnProperty(key)) {
                this.repoEditor.updateCursor(cursorData[key]);
            }
        }
        this.repoEditor.updateCursorDecorators();
    }

    // 连接到仓库
    public async connectRepo(isNew: boolean) {
        this.repoEditor.startInitRepo();

        if (isNew) {
            await this.initRepo();
        } else {
            await this.joinRepo();
        }

        this.workspaceWatcher.setListeners();

        let cursorDoc = this.sharedbConnection.createCursorDoc(this);
        DocManager.addRepoDoc(this, cursorDoc);
    }

    // 建立基础连接
    // 包括WebSocket连接和ShareDB连接
    private async connect() {
        // 创建等待站点ID的Promise
        this.siteIdPendingPromise = new PendingPromise();
        
        // 依次建立WebSocket和ShareDB连接
        await this.websocketConnection.connect();
        await this.sharedbConnection.connect();
        
        // 等待服务器分配站点ID
        await this.siteIdPendingPromise.promise;
    }

    // 关闭仓库连接并清理资源
    public async closeRepo() {
        // 关闭所有打开的文件
        for(let file of this.fileMap.values()) {
            if(file.getIsOpened()) {
                await this.onLocalFileClose(file.getRelativePath());
            }
        }

        // 清理用户列表和文件映射
        this.users = [];
        this.fileMap.clear();

        // 创建离开会话的动作
        const sessionLeaveAction = new SessionLeaveAction(this.user);
      
        // 获取光标文档
        let doc = DocManager.getRepoDoc(this);
        let docData = doc?.data.cursor;
      
        // 如果存在当前用户的光标数据，则删除它
        if (docData.hasOwnProperty(this.user.getSiteId()!)) {
            let op: { p: [string, string]; od?: Object; oi?: Object }[] = [];
            let cursorData = docData[this.user.getSiteId()!];
            op.push({ p: ["cursor", this.user.getSiteId()!], od: cursorData });
            doc?.submitOp(op);
        }
      
        // 发送离开消息并关闭所有连接
        await this.websocketConnection.sendData(sessionLeaveAction);
        await this.websocketConnection.close();
        await this.sharedbConnection.close();

        // 清理本地资源
        this.repoEditor.localLeave();
        this.workspaceWatcher.removeListeners();
        DocManager.clear();
    }

    // 初始化新仓库
    private async initRepo() {
        // 将当前用户添加到用户列表
        this.users.push(this.user);
        
        // 建立连接
        await this.connect();
        
        // 获取本地仓库的压缩数据
        const data = await this.repoEditor.getZipData();
        
        // 创建初始化会话的动作并发送
        const sessionInitAction = new SessionInitAction(this.user, data.toString('latin1'));
        await this.websocketConnection.sendData(sessionInitAction);
        
        // 完成仓库初始化
        this.repoEditor.finishInitRepo(this.user, this.users);
    }

    // 加入现有仓库
    private async joinRepo() {
        // 建立连接
        await this.connect();
        
        // 创建等待仓库数据的Promise
        this.zippedDataPendingPromise = new PendingPromise();
        
        // 创建加入会话的动作并发送
        const sessionJoinAction = new SessionJoinAction(this.user);
        await this.websocketConnection.sendData(sessionJoinAction);
        
        // 等待接收仓库数据
        await this.zippedDataPendingPromise.promise;
        
        // 完成仓库初始化
        this.repoEditor.finishInitRepo(this.user, this.users);
    }

    // WebSocket消息处理函数
    // 使用互斥锁确保消息按顺序处理
    private onMessage = async(message: BaseMessage) => {
        await this.mutex.runExclusive(async() => {
            // 处理压缩数据消息
            if(message.messageType === MessageType.ZippedDataMessage) {
                this.onZipDataMessage(message as ZippedDataMessage);
            }
            // 处理站点ID消息
            else if(message.messageType === MessageType.SiteIdMessage) {
                this.onSiteIdMessage(message as SiteIdMessage);
            }
            // 处理其他WebSocket消息
            else {
                await this.onWebSocketMessage(message as WebSocketMessage);
            }
        })
    }

    // WebSocket错误处理函数
    private onError = async(ee: ErrorEvent) => {
        // 清理连接资源
        this.clearConnection();
    }

    // WebSocket连接关闭处理函数
    private onClose = async(ce: CloseEvent) => {
        // 清理连接资源
        this.clearConnection();
    }

    // 清理连接资源的辅助函数
    private clearConnection() {
        // 关闭WebSocket连接
        this.websocketConnection.close();
        // 关闭ShareDB连接
        this.sharedbConnection.close();
    }

    // 处理站点ID消息
    private onSiteIdMessage(siteIdMessage: SiteIdMessage) {
        // 设置用户的站点ID
        this.user.setSiteId(siteIdMessage.siteId!);
        // 解决等待站点ID的Promise
        this.siteIdPendingPromise?.resolve();
    }

    // 处理压缩数据消息
    private async onZipDataMessage(zippedDataMessage: ZippedDataMessage) {
        // 更新用户列表
        this.users = [...zippedDataMessage.users!];
        // 解压并加载仓库数据
        await this.repoEditor.unzipRepoData(Buffer.from(zippedDataMessage.data!, "latin1"));
        // 解决等待数据的Promise
        this.zippedDataPendingPromise?.resolve();
    }

    // 处理WebSocket消息
    // 根据不同的动作类型分发到对应的处理函数
    private onWebSocketMessage = async(websocketMessage: WebSocketMessage) => {
        switch(websocketMessage.data.actionType) {
            case ActionType.SessionInitAction:
                // 用户不会收到SessionInitAction
                break;
            case ActionType.SessionJoinAction:
                this.onSessionJoinAction(websocketMessage.data as SessionJoinAction);
                break;
            case ActionType.SessionLeaveAction:
                this.onSessionLeaveAction(websocketMessage.data as SessionLeaveAction);
                break;
            case ActionType.NodeCreateAction:
                await this.onNodeCreateAction(websocketMessage.data as NodeCreateAction);
                break;
            case ActionType.NodeDeleteAction:
                await this.onNodeDeleteAction(websocketMessage.data as NodeDeleteAction);
                break;
            case ActionType.NodeRenameAction:
                await this.onNodeRenameAction(websocketMessage.data as NodeRenameAction);
                break;
            case ActionType.FileCloseAction:
                this.onFileCloseAction(websocketMessage.data as FileCloseAction);
                break;
            case ActionType.FileOpenAction:
                await this.onFileOpenAction(websocketMessage.data as FileOpenAction);
                break;
            default:
                break;
        }  
    }

    // 处理用户加入会话的消息
    // 如果不是当前用户自己，则添加到用户列表并更新UI
    private onSessionJoinAction(sessionJoinAction: SessionJoinAction) {
        // 确保不是当前用户自己的加入消息
        if(sessionJoinAction.clientUser?.siteId !== this.getSiteId()) {
            // 添加新用户到用户列表
            this.users.push(sessionJoinAction.clientUser!);
            // 更新UI显示新用户加入
            this.repoEditor.userJoin(sessionJoinAction.clientUser!, this.users);
        }
    }

    // 处理用户离开会话的消息
    private onSessionLeaveAction(sessionLeaveAction: SessionLeaveAction) {
        // 在用户列表中查找要离开的用户
        const targetUserIndex = this.users.findIndex(
            (user) => user.siteId === sessionLeaveAction.clientUser?.siteId
        );
        // 从用户列表中移除该用户
        this.users.splice(targetUserIndex, 1);
        // 更新UI显示用户离开
        this.repoEditor.userLeave(sessionLeaveAction.clientUser!, this.users);
    }

    // 处理节点（文件/文件夹）创建的消息
    private async onNodeCreateAction(nodeCreateAction: NodeCreateAction) {
        // 在编辑器中创建新节点
        await this.repoEditor.nodeCreate(
            nodeCreateAction.path!,
            nodeCreateAction.clientUser!,
            nodeCreateAction.isFile!
        );
    }

    // 处理节点（文件/文件夹）删除的消息
    private async onNodeDeleteAction(nodeDeleteAction: NodeDeleteAction) {
        // 查找要删除的文件
        let targetFile = this.fileMap.get(nodeDeleteAction.path!);
        if(targetFile) {
            // 如果文件存在，从文档管理器中移除
            let doc = DocManager.getDoc(targetFile!);
            if(doc) {
                DocManager.removeDoc(targetFile);
            }
            // 从文件映射中移除
            this.fileMap.delete(nodeDeleteAction.path!);
        }
        // 在编辑器中删除节点
        await this.repoEditor.nodeDelete(
            nodeDeleteAction.path!,
            nodeDeleteAction.clientUser!,
            nodeDeleteAction.isFile!
        );
    }

    // 处理节点（文件/文件夹）重命名的消息
    private async onNodeRenameAction(nodeRenameAction: NodeRenameAction) {
        // 在编辑器中重命名节点
        await this.repoEditor.nodeRename(
            nodeRenameAction.path!,
            nodeRenameAction.newName!,
            nodeRenameAction.clientUser!,
            nodeRenameAction.isFile!
        );
    }

    // 处理文件关闭的消息
    private onFileCloseAction(fileCloseAction: FileCloseAction) {
        // 查找要关闭的文件
        const targetFile = this.fileMap.get(fileCloseAction.path!);
        if (targetFile) {
            // 从文件的打开用户列表中移除该用户
            targetFile.removeOpenUser(fileCloseAction.clientUser!);
        }
        // 更新UI显示文件关闭
        this.repoEditor.fileClose(fileCloseAction.path!, fileCloseAction.clientUser!);
    }

    // 处理远程用户打开文件的消息
    private async onFileOpenAction(fileOpenAction: FileOpenAction) {
        // 查找目标文件是否已存在
        let targetFile = this.fileMap.get(fileOpenAction.path!);
        
        if (targetFile) {
            // 如果文件已存在，添加打开该文件的用户
            targetFile.addOpenUser(fileOpenAction.clientUser!);
        } else {
            // 如果文件不存在，创建新的文件实例
            targetFile = new ClientFile(this, new FileEditor(this.repoEditor, false, fileOpenAction.path!));
            targetFile.addOpenUser(fileOpenAction.clientUser!);
            this.fileMap.set(fileOpenAction.path!, targetFile);
            targetFile = this.fileMap.get(fileOpenAction.path!)!;
            
            // 获取或创建ShareDB文档
            let doc;
            doc = DocManager.getDoc(targetFile);
            if (doc === null || doc === undefined) {
                doc = await this.sharedbConnection.createFileDoc(targetFile, fileOpenAction);
                DocManager.addDoc(targetFile, doc);
            }
            targetFile.setVersion(doc!.version!);
        }
        
        // 更新UI显示文件被打开
        this.repoEditor.fileOpen(targetFile.getRelativePath(), fileOpenAction.clientUser!);
    }

    // 处理本地打开文件的事件
    public async onLocalFileOpen(textDocument: TextDocument) {
        await this.mutex.runExclusive(async () => {
            // 获取文件的相对路径
            let targetFile = this.fileMap.get(this.repoEditor.getRelativePath(textDocument.uri.fsPath));
            
            if(!targetFile) {
                // 如果文件不存在于映射中，创建新的文件实例
                targetFile = new ClientFile(this, new FileEditor(this.repoEditor, true, textDocument));
                targetFile.addOpenUser(this.user);
                this.fileMap.set(targetFile.getRelativePath(), targetFile);

                // 获取或创建ShareDB文档
                let doc = DocManager.getDoc(targetFile);
                if(doc === null || doc === undefined) {
                    let fileOpenAction = new FileOpenAction(this.user, targetFile.getRelativePath(), targetFile.getFileName());
                    doc = await this.sharedbConnection.createFileDoc(targetFile, fileOpenAction);
                    DocManager.addDoc(targetFile, doc);
                }
                targetFile.setVersion(doc!.version!);
            }
            else if(!targetFile.getIsOpened()) {
                // 如果文件存在但未打开，重新设置文件编辑器
                targetFile.addOpenUser(this.user);
                targetFile.resetFileEditor(new FileEditor(this.repoEditor, true, textDocument));

                // 获取或创建ShareDB文档
                let doc = DocManager.getDoc(targetFile);
                if(doc === null || doc === undefined) {
                    let fileOpenAction = new FileOpenAction(this.user, targetFile.getRelativePath(), targetFile.getFileName());
                    doc = await this.sharedbConnection.createFileDoc(targetFile, fileOpenAction);
                    DocManager.addDoc(targetFile, doc);
                }
                targetFile.setVersion(doc!.version!);
            }
            // 如果文件已经打开，不需要额外操作

            // 发送文件打开消息到服务器
            let fileOpenAction = new FileOpenAction(this.user, targetFile.getRelativePath(), targetFile.getFileName());
            await this.websocketConnection.sendData(fileOpenAction);
        });
    }

    // 处理本地文件关闭事件
    public async onLocalFileClose(path: string) {
        // 获取目标文件
        let targetFile = this.fileMap.get(path);
        // 如果文件不存在或未打开，直接返回
        if(!targetFile || !targetFile.getIsOpened()) {
            return;
        }

        // 使用互斥锁确保操作的原子性
        await this.mutex.runExclusive(async () => {
            // 重置文件编辑器状态
            targetFile.resetFileEditor(new FileEditor(this.repoEditor, false, path));
            // 创建并发送文件关闭动作
            let fileCloseAction = new FileCloseAction(this.user, path, targetFile.getFileName());
            await this.websocketConnection.sendData(fileCloseAction);
        });
    }

    // 处理本地文件内容变更事件
    public async onLocalFileChange(textDocumentChangeEvent: TextDocumentChangeEvent) {
        // 获取发生变更的文件
        let targetFile = this.fileMap.get(
            this.repoEditor.getRelativePath(textDocumentChangeEvent.document.uri.fsPath)
        );
        // 更新文件内容
        await targetFile?.fileContentUpdate(textDocumentChangeEvent);
    }

    // 处理本地光标移动事件
    public async onLocalCursorMove(path: string, fileName: string, position: number) {
        // 获取当前用户
        let user = this.user;
        // 获取光标文档
        let doc = DocManager.getRepoDoc(this);
        let docData = doc?.data.cursor;
        
        // 准备光标操作数据
        let op: { p: [string, string]; od?: Object; oi?: Object }[] = [];
        // 创建要插入的光标数据
        let insertData = {
            user: this.user,
            cursorPosition: {
                filePath: path,
                position: position,
            },
        };

        // 如果该用户已有光标数据，则替换；否则新增
        if (docData?.hasOwnProperty(user.getSiteId()!)) {
            let cursorData = docData[user.getSiteId()!];
            op.push({ p: ["cursor", user.getSiteId()!], od: cursorData, oi: insertData });
        } else {
            op.push({ p: ["cursor", user.getSiteId()!], oi: insertData });
        }

        // 提交光标操作
        await doc?.submitOp(op);
        // 更新本地光标显示
        this.repoEditor.localMoveCursor(insertData);
        this.repoEditor.updateCursorDecorators();
    }

    // 处理本地节点删除事件
    public async onLocalNodeDelete(path: string, fileName: string, isFile: boolean) {
        // 如果是文件，需要清理相关资源
        let targetFile = this.fileMap.get(path);
        if(targetFile) {
            // 从文档管理器中移除文档
            let doc = DocManager.getDoc(targetFile!);
            if(doc) {
                DocManager.removeDoc(targetFile);
            }
            // 从文件映射中移除
            this.fileMap.delete(path);
        }

        // 使用互斥锁确保操作的原子性
        await this.mutex.runExclusive(async () => {
            // 创建并发送节点删除动作
            let nodeDeleteAction = new NodeDeleteAction(
                this.user,
                path,
                fileName,
                isFile
            );
            await this.websocketConnection.sendData(nodeDeleteAction);
        });
    }
} 