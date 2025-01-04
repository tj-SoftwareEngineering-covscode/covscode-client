import * as vscode from 'vscode';
import { RepoEditor } from '../editor/repoEditor';
import { WebSocketConnection } from '../connection/websocketConnection';
import { SharedbConnection } from '../connection/sharedbConnection';
import { ClientUser } from './clientUser';
import { UserInput } from '../extension';
import { SessionInitAction } from '../action/session/sessionInitAction';
import { SessionJoinAction } from '../action/session/sessionJoinAction';
import { BaseMessage } from '../message/baseMessage';
import { PendingPromise } from '../util/pendingPromise';
import { ErrorEvent, CloseEvent } from 'ws';
import { SiteIdMessage } from '../message/siteIdMessage';
import { ZippedDataMessage } from '../message/zippedDataMessage';

export class ClientRepo{
    private serverAddress: string;
    private repoEditor: RepoEditor;
    private websocketConnection: WebSocketConnection;
    private sharedbConnection: SharedbConnection;
    private user: ClientUser;
    private users: ClientUser[]=[]; 
    private zippedDataPendingPromise?: PendingPromise;
    private siteIdPendingPromise?: PendingPromise;

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
        //待补全
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

    private onZipDataMessage(zippedDataMessage:ZippedDataMessage){
        this.users = [...zippedDataMessage.getUsers()!];

        //待补全执行逻辑

        this.zippedDataPendingPromise?.resolve();
    }
} 