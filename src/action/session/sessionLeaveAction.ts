import { BaseAction, ActionType } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class SessionLeaveAction extends BaseAction{
    constructor(clientUser?:ClientUser){
        super(ActionType.SessionLeaveAction, clientUser);
    }
}
