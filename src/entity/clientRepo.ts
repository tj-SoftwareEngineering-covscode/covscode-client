import * as vscode from 'vscode';
import { RepoEditor } from '../editor/repoEditor';
import WebSocketConnection from '../connection/websocketConnection';

export class ClientRepo{
    private serverAddress: string;
    private repoEditor: RepoEditor;
    private websocketConnection: WebSocketConnection;

    constructor(serverAddress: string, repoEditor: RepoEditor){
        this.serverAddress = serverAddress;
        this.repoEditor = repoEditor;
        this.websocketConnection = new WebSocketConnection(this.serverAddress, 'websocket');
    } 

    public async connectRepo(userId:string, repoId:string, isNew:boolean){
        this.websocketConnection.connect();
    }
} 