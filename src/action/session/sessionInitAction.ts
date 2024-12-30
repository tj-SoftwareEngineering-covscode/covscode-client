import { BaseAction } from '../baseAction';
import { ClientUser } from '../../entity/clientUser';

export class SessionInitAction extends BaseAction{
    constructor(clientUser?:ClientUser){
        super(clientUser);
    }
}