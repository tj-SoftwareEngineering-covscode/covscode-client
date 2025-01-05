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

export class ClientRepo{
    private serverAddress: string;
    private repoEditor: RepoEditor;
    private websocketConnection: WebSocketConnection;
    private sharedbConnection: SharedbConnection;
    private workspaceWatcher: WorkspaceWatcher;
    private user: ClientUser;
    private users: ClientUser[]=[]; 
    private fileMap: Map<string, ClientFile> = new Map();
    private zippedDataPendingPromise?: PendingPromise;
    private siteIdPendingPromise?: PendingPromise;
    private mutex: Mutex=new Mutex();

    constructor(userInput:UserInput, repoEditor: RepoEditor){
        this.serverAddress = userInput.serverAddress;
        this.repoEditor = repoEditor;
        this.workspaceWatcher = new WorkspaceWatcher(this, this.repoEditor);
        this.websocketConnection = new WebSocketConnection(this.serverAddress);
        this.sharedbConnection = new SharedbConnection(this.serverAddress);
        this.user = new ClientUser();
        this.user.setUserId(userInput.userId);
        this.user.setRepoId(userInput.repoId);

        this.setWebsocketListeners();
    } 

    public get connectionStatus(){
        return this.websocketConnection.readyState;
    }

    public getRepoId(){
        return this.user.getRepoId();
    }

    public getUserId(){
        return this.user.getUserId();
    }

    public getSiteId(){
        return this.user.getSiteId();
    }

    public getUser(){
        return this.user;
    }

    public getWebsocketConnection(){
        return this.websocketConnection;
    }

    private setWebsocketListeners(){
        this.websocketConnection.on('message', this.onMessage);
        this.websocketConnection.on('error', this.onError);
        this.websocketConnection.on('close', this.onClose);
    }

    public setCursorData(cursorData: { [key: string]: any }) {
        for (var key in cursorData) {
            if (cursorData.hasOwnProperty(key)) {
                this.repoEditor.updateCursor(cursorData[key]);
            }
        }
        this.repoEditor.updateCursorDecorators();
    }

    //连接仓库
    public async connectRepo(isNew:boolean){
        this.repoEditor.startInitRepo();

        if(isNew){
            this.initRepo();
        }else{
            this.joinRepo();
        }

        this.workspaceWatcher.setListeners();

        let cursorDoc=this.sharedbConnection.createCursorDoc(this);
        DocManager.addRepoDoc(this, cursorDoc);
    }

    private async connect(){
        this.siteIdPendingPromise = new PendingPromise();
        await this.websocketConnection.connect();
        await this.sharedbConnection.connect();
        await this.siteIdPendingPromise.promise;
    }

    public async closeRepo(){
        await Promise.all(
            [...this.fileMap.keys()]
              .filter((key) => this.fileMap.get(key)?.getIsOpened())
              .map(this.onLocalFileClose)
        );
        this.users = [];
        this.fileMap.clear();
        const sessionLeaveAction = new SessionLeaveAction(this.user);
      
        let doc = DocManager.getRepoDoc(this);
        let docData = doc?.data.cursor;
      
        if (docData.hasOwnProperty(this.user.getSiteId()!)) {
            let op: { p: [string, string]; od?: Object; oi?: Object }[] = [];
            let cursorData = docData[this.user.getSiteId()!];
            op.push({ p: ["cursor", this.user.getSiteId()!], od: cursorData });
            doc?.submitOp(op);
        }
      
        await this.websocketConnection.sendData(sessionLeaveAction);
        await this.websocketConnection.close();
        this.repoEditor.localLeave();
        this.workspaceWatcher.removeListeners();
        DocManager.clear();
    }

    //新建仓库的操作
    private async initRepo(){
        this.repoEditor.startInitRepo();
        this.users.push(this.user);
        await this.connect();
        const data=await this.repoEditor.getZipData();
        const sessionInitAction = new SessionInitAction(this.user, data.toString('utf-8'));
        await this.websocketConnection.sendData(sessionInitAction);
        this.repoEditor.finishInitRepo(this.user, this.users);
    }

    //加入仓库的操作
    private async joinRepo(){
        this.repoEditor.startInitRepo();
        await this.connect();
        this.zippedDataPendingPromise = new PendingPromise();
        const sessionJoinAction = new SessionJoinAction(this.user);
        await this.websocketConnection.sendData(sessionJoinAction);
        await this.zippedDataPendingPromise.promise;
        this.repoEditor.finishInitRepo(this.user, this.users);
    }

    private onMessage=async(message:BaseMessage)=>{
        await this.mutex.runExclusive(async()=>{
            if(message.getMessageType()===MessageType.ZippedDataMessage){
                this.onZipDataMessage(message as ZippedDataMessage);
            }
            else if(message.getMessageType()===MessageType.SiteIdMessage){
                this.onSiteIdMessage(message as SiteIdMessage);
            }
            else{
                this.onWebSocketMessage(message as WebSocketMessage);
            }
        })
    }

    private onError=async(ee: ErrorEvent)=>{
        this.clearConnection();
    }

    private onClose=async(ce: CloseEvent)=>{
        this.clearConnection();
    }

    private clearConnection(){
        this.websocketConnection.close();
        this.sharedbConnection.close();
    }

    private onSiteIdMessage(siteIdMessage:SiteIdMessage){
        this.user.setSiteId(siteIdMessage.getSiteId()!);
        this.siteIdPendingPromise?.resolve();
    }

    private async onZipDataMessage(zippedDataMessage:ZippedDataMessage){
        this.users = [...zippedDataMessage.getUsers()!];
        await this.repoEditor.unzipRepoData(Buffer.from(zippedDataMessage.getData()!, "utf-8"));
        this.zippedDataPendingPromise?.resolve();
    }

    //进一步对WebSocketMessage进行分类
    private onWebSocketMessage(websocketMessage:WebSocketMessage){
        switch(websocketMessage.getData().getActionType()){
            case ActionType.SessionInitAction:
                //用户不会收到SessionInitAction
                break;
            case ActionType.SessionJoinAction:
                this.onSessionJoinAction(websocketMessage.getData() as SessionJoinAction);
                break;
            case ActionType.SessionLeaveAction:
                this.onSessionLeaveAction(websocketMessage.getData() as SessionLeaveAction);
                break;
            case ActionType.NodeCreateAction:
                this.onNodeCreateAction(websocketMessage.getData() as NodeCreateAction);
                break;
            case ActionType.NodeDeleteAction:
                this.onNodeDeleteAction(websocketMessage.getData() as NodeDeleteAction);
                break;
            case ActionType.NodeRenameAction:
                this.onNodeRenameAction(websocketMessage.getData() as NodeRenameAction);
                break;
            case ActionType.FileCloseAction:
                this.onFileCloseAction(websocketMessage.getData() as FileCloseAction);
                break;
            case ActionType.FileOpenAction:
                this.onFileOpenAction(websocketMessage.getData() as FileOpenAction);
                break;
            default:
                break;
        }  
    }

    private onSessionJoinAction(sessionJoinAction:SessionJoinAction){
        if(sessionJoinAction.getClientUser()?.getSiteId()!==this.getSiteId()){
            this.users.push(sessionJoinAction.getClientUser()!);
            this.repoEditor.userJoin(sessionJoinAction.getClientUser()!, this.users);
        }
    }

    private onSessionLeaveAction(sessionLeaveAction:SessionLeaveAction){
        const targetUserIndex = this.users.findIndex(
            (user) => user.getSiteId() === sessionLeaveAction.getClientUser()?.getSiteId()
        );
        this.users.splice(targetUserIndex, 1);
        this.repoEditor.userLeave(sessionLeaveAction.getClientUser()!, this.users);
    }

    private async onNodeCreateAction(nodeCreateAction:NodeCreateAction){
        await this.repoEditor.nodeCreate(nodeCreateAction.getPath()!, nodeCreateAction.getClientUser()!, nodeCreateAction.getIsFile()!);
    }

    private async onNodeDeleteAction(nodeDeleteAction:NodeDeleteAction){
        await this.repoEditor.nodeDelete(nodeDeleteAction.getPath()!, nodeDeleteAction.getClientUser()!, nodeDeleteAction.getIsFile()!);
    }

    private async onNodeRenameAction(nodeRenameAction:NodeRenameAction){
        await this.repoEditor.nodeRename(nodeRenameAction.getPath()!, nodeRenameAction.getNewName()!, nodeRenameAction.getClientUser()!, nodeRenameAction.getIsFile()!);
    }

    private onFileCloseAction(fileCloseAction:FileCloseAction){
        const targetFile = this.fileMap.get(fileCloseAction.getPath()!);
        if (targetFile) {
            targetFile.removeOpenUser(fileCloseAction.getClientUser()!);
        }
        this.repoEditor.fileClose(fileCloseAction.getPath()!, fileCloseAction.getClientUser()!);
    }

    private onFileOpenAction(fileOpenAction:FileOpenAction){
        let targetFile = this.fileMap.get(fileOpenAction.getPath()!);
        if (targetFile) {
            targetFile.addOpenUser(fileOpenAction.getClientUser()!);
        } else {
            targetFile = new ClientFile(this, new FileEditor(this.repoEditor, false, fileOpenAction.getPath()!));
            targetFile.addOpenUser(fileOpenAction.getClientUser()!);
            this.fileMap.set(fileOpenAction.getPath()!, targetFile);
            targetFile = this.fileMap.get(fileOpenAction.getPath()!)!;
            let doc;
            doc = DocManager.getDoc(targetFile);
            if (doc === null) {
                doc = this.sharedbConnection.createFileDoc(targetFile, fileOpenAction);
                DocManager.addDoc(targetFile, doc);
            }
            targetFile.setVersion(doc!.version!);
        }
        this.repoEditor.fileOpen(targetFile.getRelativePath(), fileOpenAction.getClientUser()!);
    }

    public async onLocalFileOpen(textDocument: TextDocument){
        await this.mutex.runExclusive(async () =>{
            let targetFile = this.fileMap.get(this.repoEditor.getRelativePath(textDocument.uri.fsPath));
            if(!targetFile){
                targetFile = new ClientFile(this, new FileEditor(this.repoEditor, true, textDocument));
                targetFile.addOpenUser(this.user);
                this.fileMap.set(targetFile.getRelativePath(), targetFile);

                let doc=DocManager.getDoc(targetFile);
                if(doc===null){
                    let fileOpenAction=new FileOpenAction(this.user, targetFile.getRelativePath(), targetFile.getFileName());
                    doc=this.sharedbConnection.createFileDoc(targetFile, fileOpenAction);
                    DocManager.addDoc(targetFile, doc);
                }
                targetFile.setVersion(doc!.version!);
            }
            else if(!targetFile.getIsOpened()){
                targetFile.addOpenUser(this.user);
                targetFile.resetFileEditor(new FileEditor(this.repoEditor, true, textDocument));

                let doc=DocManager.getDoc(targetFile);
                if(doc===null){
                    let fileOpenAction=new FileOpenAction(this.user, targetFile.getRelativePath(), targetFile.getFileName());
                    doc=this.sharedbConnection.createFileDoc(targetFile, fileOpenAction);
                    DocManager.addDoc(targetFile, doc);
                }
                targetFile.setVersion(doc!.version!);
            }
            else{
                //已经打开了
            }

            let fileOpenAction=new FileOpenAction(this.user, targetFile.getRelativePath(), targetFile.getFileName());
            await this.websocketConnection.sendData(fileOpenAction);
        })
    }

    public async onLocalFileClose(path: string){
        let targetFile = this.fileMap.get(path);
        if(!targetFile||!targetFile.getIsOpened()){
            return;
        }

        await this.mutex.runExclusive(async () =>{
            targetFile.resetFileEditor(new FileEditor(this.repoEditor, false, path));
            let fileCloseAction=new FileCloseAction(this.user, path, targetFile.getFileName());
            await this.websocketConnection.sendData(fileCloseAction);
        })
    }

    public async onLocalFileChange(textDocumentChangeEvent: TextDocumentChangeEvent){
        let targetFile = this.fileMap.get(this.repoEditor.getRelativePath(textDocumentChangeEvent.document.uri.fsPath));
        await targetFile?.fileContentUpdate(textDocumentChangeEvent);
    }

    public async onLocalCursorMove(path: string, fileName: string, position: number){
        let user = this.user;
        let doc = DocManager.getRepoDoc(this);
        let docData = doc?.data.cursor;
        let op: { p: [string, string]; od?: Object; oi?: Object }[] = [];
        let insertData = {
            user: this.user,
            cursorPosition: {
                filePath: path,
                position: position,
            },
        };
        if (docData.hasOwnProperty(user.getSiteId()!)) {
            let cursorData = docData[user.getSiteId()!];
            op.push({ p: ["cursor", user.getSiteId()!], od: cursorData, oi: insertData });
        } else {
            op.push({ p: ["cursor", user.getSiteId()!], oi: insertData });
        }

        await doc?.submitOp(op);
        this.repoEditor.localMoveCursor(insertData);
    }
} 