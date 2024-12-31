import { BaseAction, ActionType } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class SessionInitAction extends BaseAction{
    constructor(clientUser?:ClientUser){
        super(ActionType.SessionInitAction, clientUser);
    }
}