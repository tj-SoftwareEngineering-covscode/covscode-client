import { ClientUser } from "./clientUser";
import { ClientRepo } from "./clientRepo";
import { BaseAction } from "../action/baseAction";
import { Mutex } from "async-mutex";
import { TextDocumentChangeEvent } from "vscode";
import { DocManager } from "../manager/docManager";
import * as vscode from "vscode";
import { FileEditor } from "../editor/fileEditor";

export class ClientFile{
    private openUsers:Map<string,ClientUser>=new Map();
    private clientRepo!:ClientRepo;
    private fileEditor!:FileEditor;
    private content!:string;
    private version:number;
    private versionMap:Map<number,boolean>=new Map();
    private isFromLocal:boolean;
    private isFreshing:boolean;
    public remoteRowMap:Map<number,number>=new Map();

    private mutex = new Mutex();

    constructor(clientRepo:ClientRepo, fileEditor:FileEditor){
        this.clientRepo = clientRepo;
        this.fileEditor = fileEditor;
        this.version = 0;
        this.isFromLocal = true;
        this.isFreshing = false;
    }

    public getClientRepo(){
        return this.clientRepo;
    }

    public getContent(){
        return this.content;
    }

    public getFileContent(){
        return this.fileEditor.getCurrentContent();
    }

    public getRelativePath(){
        return this.fileEditor.getRelativePath();
    }

    public getFileName(){
        return this.fileEditor.getFileName();
    }

    public setVersionMap(version:number, isFromLocal:boolean){
        this.versionMap.set(version, isFromLocal);
    }

    public getIsOpened(){
        return this.fileEditor.getIsOpened();
    }

    public setVersion(version:number){
        this.version = version;
    }

    public resetFileEditor(fileEditor:FileEditor){
        this.fileEditor = fileEditor;
    }

    public addOpenUser(user:ClientUser){
        this.openUsers.set(user.getSiteId()!, user);
    }

    public removeOpenUser(user:ClientUser){
        this.openUsers.delete(user.getSiteId()!);
    }

    public async onWrite(newContent:string){
        this.fileEditor.onRewrite(newContent);
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

    public async fileContentUpdate(textDocumentChangeEvent:TextDocumentChangeEvent){
        await this.mutex.runExclusive(async () =>{
            if(textDocumentChangeEvent.contentChanges.length===0){
                return;
            }
            
            let doc=DocManager.getDoc(this);

            if (this.getFileContent() === doc?.data.content) {
                this.content=textDocumentChangeEvent.document.getText(); // 更新内部内容
                return;
            }

            let op: { p: [string, number]; sd?: string; si?: string }[] = []; // 操作列表
            textDocumentChangeEvent.contentChanges.forEach((change) => {
                var changeText = change.text; // 变化文本
                var offset = change.rangeOffset; // 偏移量
        
                //表示为删除操作
                if (changeText === "") {
                    var oldText = this.content;
                    var deletedPart = oldText.substring(
                        offset,
                        offset + change.rangeLength
                    );
                    op.push({ p: ["content", offset], sd: deletedPart }); // 添加删除操作
                } else {
                    //表示为插入操作
                    if (change.rangeLength === 0) {
                        const editor = vscode.window.activeTextEditor;
                        let position;
                        if (editor) {
                            position = editor.selection.active;
                        }
                        offset = textDocumentChangeEvent.document.offsetAt(position!);
                        op.push({ p: ["content", offset], si: changeText });
                    } 
                    //表示为替换操作
                    else {
                        var previousText = this.content.substring(
                            offset,
                            offset + change.rangeLength
                        );
                        op.push({ p: ["content", offset], sd: previousText });
                        op.push({ p: ["content", offset], si: changeText });
                    }
                }
            });

            this.content=textDocumentChangeEvent.document.getText();

            let setVersion = () => {
                this.setVersionMap(doc?.version!, true); // 设置版本映射
            };

            if (this.getFileContent() !== doc?.data.content && !this.isFreshing) {
                doc?.submitOp(op, { source: this.clientRepo.getUserId() }, setVersion); // 提交操作，并设置 source 参数为当前用户的ID
            } else {
                this.isFreshing = false; // 重置刷新标志
            }
        })
    }
}