import * as vscode from 'vscode';
import { RepoEditor } from '../editor/repoEditor';
import { WebSocketConnection } from '../connection/websocketConnection';
import { ClientUser } from './clientUser';
import { UserInput } from '../extension';
import { SessionInitAction } from '../action/session/sessionInitAction';
import { SessionJoinAction } from '../action/session/sessionJoinAction';
import { BaseMessage } from '../message/baseMessage';
import { SiteIdMessage } from '../message/siteIdMessage';

export class ClientRepo{
    private serverAddress: string;
    private repoEditor: RepoEditor;
    private websocketConnection: WebSocketConnection;
    private user: ClientUser;
    private users: ClientUser[]=[]; 

    constructor(userInput:UserInput, repoEditor: RepoEditor){
        this.serverAddress = userInput.serverAddress;
        this.repoEditor = repoEditor;
        this.websocketConnection = new WebSocketConnection(this.serverAddress, 'websocket');
        this.user = new ClientUser();
        this.user.setUserId(userInput.userId);
        this.user.setRepoId(userInput.repoId);
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

    public async connectRepo(isNew:boolean){
        if(isNew){
            this.initRepo();
        }else{
            this.joinRepo();
        }
    }

    private async connect(){
        await this.websocketConnection.connect();
    }

    public async closeRepo(){
        await this.websocketConnection.close();
    }

    //新建仓库的操作
    private async initRepo(){
        await this.connect();
        this.users.push(this.user);
        const sessionInitAction = new SessionInitAction(this.user);
        await this.websocketConnection.sendData(sessionInitAction);
    }

    //加入仓库的操作
    private async joinRepo(){
        await this.connect();
        const sessionJoinAction = new SessionJoinAction(this.user);
        await this.websocketConnection.sendData(sessionJoinAction);
    }

    private onMessage=async(message:BaseMessage)=>{
        //待补全
    }
} 