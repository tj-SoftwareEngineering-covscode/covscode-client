import { BaseAction, ActionType } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class SessionInitAction extends BaseAction{
    private content?:string;

    constructor(clientUser?:ClientUser,content?:string){
        super(ActionType.SessionInitAction, clientUser);
        this.content=content;
    }

    public setContent(content:string){
        this.content=content;
    }

    public getContent(){
        return this.content;
    }
}