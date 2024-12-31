import { BaseAction } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class NodeDeleteAction extends BaseAction{
    private path?:string;
    private name?:string;
    private isFile?:boolean;

    constructor(clientUser?:ClientUser, path?:string, name?:string, isFile?:boolean){
        super(clientUser);
        this.path = path;
        this.name = name;
        this.isFile = isFile;
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

    public setPath(path:string){
        this.path = path;
    }

    public setName(name:string){
        this.name = name;
    }

    public setIsFile(isFile:boolean){
        this.isFile = isFile;
    }
}