import { BaseAction, ActionType } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class SessionJoinAction extends BaseAction{
    constructor(clientUser?:ClientUser){
        super(ActionType.SessionJoinAction, clientUser);
    }
}