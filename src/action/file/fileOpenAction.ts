import { BaseAction, ActionType } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class FileOpenAction extends BaseAction{
    private path?:string;
    private name?:string;

    constructor(clientUser?:ClientUser, path?:string, name?:string){
        super(ActionType.FileOpenAction, clientUser);
        this.path = path;
        this.name = name;
    }

    public getPath(){
        return this.path;
    }

    public getName(){
        return this.name;
    } 

    public setPath(path:string){
        this.path = path;
    }

    public setName(name:string){
        this.name = name;
    }
}
