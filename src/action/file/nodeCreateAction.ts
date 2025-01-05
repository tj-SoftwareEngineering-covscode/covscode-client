import { BaseAction, ActionType } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class NodeCreateAction extends BaseAction{
    path?:string;
    name?:string;
    isFile?:boolean;
    content?:string;

    constructor(clientUser?:ClientUser, path?:string, name?:string, isFile?:boolean, content?:string){
        super(ActionType.NodeCreateAction, clientUser);
        this.path = path;
        this.name = name;
        this.isFile = isFile;
        this.content = content;
    }

    public getPath(){
        return this.path;
    }

    public getName(){
        return this.name;
    }  

    public getIsFile(){
        return this.isFile;
    }

    public getContent(){
        return this.content;
    }

    public setPath(path:string){
        this.path = path;
    }

    public setName(name:string){
        this.name = name;
    }

    public setIsFile(isFile:boolean){
        this.isFile = isFile;
    }

    public setContent(content:string){
        this.content = content;
    }
}