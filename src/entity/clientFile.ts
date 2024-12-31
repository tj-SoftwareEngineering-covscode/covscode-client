import { ClientUser } from "./clientUser";
import { ClientRepo } from "./clientRepo";
import { BaseAction } from "../action/baseAction";
import { Mutex } from "async-mutex";
import { TextDocumentChangeEvent } from "vscode";

export class ClientFile{
    private openUsers:Map<string,ClientUser>=new Map();
    private clientRepo!:ClientRepo;
    private content!:string;
    private version:number;
    private versionMap:Map<number,boolean>=new Map();
    private isFromLocal:boolean;
    private isFreshing:boolean;
    public remoteRowMap:Map<number,number>=new Map();

    private mutex = new Mutex();

    constructor(clientRepo:ClientRepo){
        this.clientRepo = clientRepo;
        this.version = 0;
        this.isFromLocal = true;
        this.isFreshing = false;
    }

    public async excute(action:BaseAction){
        await this.mutex.runExclusive(async()=>{
            await this.classifyAction(action);
        });
    }

    private async classifyAction(action:BaseAction){

    }

    public static getDeletePart(originalText: string, modifiedText: string){
        let deletion = "";
        let originalIndex = 0;
        let modifiedIndex = 0;
        let deletionStart = -1;
 
        while (originalIndex < originalText.length && modifiedIndex < modifiedText.length) {
            if (originalText[originalIndex] !== modifiedText[modifiedIndex]) {
                if (deletionStart === -1) {
                    deletionStart = originalIndex;
                }
                originalIndex++;
            } else {
                if (deletionStart !== -1) {
                    deletion = originalText.substring(deletionStart, originalIndex);
                    break;
                }
                originalIndex++;
                originalIndex++;
                modifiedIndex++;
            }
        }
        if (deletion === "" && deletionStart !== -1) {
            deletion = originalText.substring(deletionStart);
        }
        return deletion;
    }

    public fileUpdate(textDocumentChangeEvent:TextDocumentChangeEvent){
        //待补全
    }
}