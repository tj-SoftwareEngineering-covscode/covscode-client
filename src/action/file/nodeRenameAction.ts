import { BaseAction } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class NodeRenameAction extends BaseAction{
    private path?:string;
    private name?:string;
    private isFile?:boolean;
    private newName?:string;

    constructor(clientUser?:ClientUser, path?:string, name?:string, isFile?:boolean, newName?:string){
        super(clientUser);
        this.path = path;
        this.name = name;
        this.isFile = isFile;
        this.newName = newName;
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

    public getNewName(){
        return this.newName;
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

    public setNewName(newName:string){
        this.newName = newName;
    }
}
