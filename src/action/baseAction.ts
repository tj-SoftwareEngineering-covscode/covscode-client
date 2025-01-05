import { ClientUser } from '../entity/clientUser';

export enum ActionType{
    FileOpenAction = 'FileOpenAction',
    FileCloseAction = 'FileCloseAction',
    NodeCreateAction = 'NodeCreateAction',
    NodeDeleteAction = 'NodeDeleteAction',
    NodeRenameAction = 'NodeRenameAction',
    SessionInitAction = 'SessionInitAction',
    SessionJoinAction = 'SessionJoinAction',
    SessionLeaveAction = 'SessionLeaveAction'
}

export class BaseAction{
    actionType:ActionType;
    clientUser?:ClientUser;
    time:Date;

    constructor(actionType:ActionType, clientUser?:ClientUser){
        this.actionType = actionType;
        this.clientUser = clientUser;
        this.time = new Date();
    }

    public setClientUser(clientUser:ClientUser){
        this.clientUser = clientUser;
    }

    public getClientUser(){
        return this.clientUser;
    }

    public getTime(){
        return this.time;
    }

    public getActionType(){
        return this.actionType;
    }
}