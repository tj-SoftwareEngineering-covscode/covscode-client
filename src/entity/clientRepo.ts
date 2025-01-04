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

export class ClientRepo{
    private serverAddress: string;
    private repoEditor: RepoEditor;
    private websocketConnection: WebSocketConnection;
    private sharedbConnection: SharedbConnection;
    private user: ClientUser;
    private users: ClientUser[]=[]; 
    private fileMap: Map<string, ClientFile> = new Map();
    private zippedDataPendingPromise?: PendingPromise;
    private siteIdPendingPromise?: PendingPromise;
    private mutex: Mutex=new Mutex();

    constructor(userInput:UserInput, repoEditor: RepoEditor){
        this.serverAddress = userInput.serverAddress;
        this.repoEditor = repoEditor;

        //待补全watcher内容

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

    //连接仓库
    public async connectRepo(isNew:boolean){
        this.repoEditor.startInitRepo();

        if(isNew){
            this.initRepo();
        }else{
            this.joinRepo();
        }

        //待补全watcher内容

        //待补全cursor的doc内容
    }

    private async connect(){
        this.siteIdPendingPromise = new PendingPromise();
        await this.websocketConnection.connect();
        await this.sharedbConnection.connect();
        await this.siteIdPendingPromise.promise;
    }

    public async closeRepo(){
        //待补全
        await this.websocketConnection.close();
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
        //待补全
    }

    private onClose=async(ce: CloseEvent)=>{
        //待补全
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

    public onLocalFileOpen(textDocument: TextDocument){
        //待补全
    }

    public onLocalFileClose(path: string){
        //待补全
    }

    public onLocalFileChange(textDocumentChangeEvent: TextDocumentChangeEvent){
        //待补全
    }
} 