import { BaseAction } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class FileCloseAction extends BaseAction{
    private path?:string;   
    private name?:string;

    constructor(clientUser?:ClientUser, path?:string, name?:string){
        super(clientUser);
        this.path = path;
        this.name = name;
    }
}