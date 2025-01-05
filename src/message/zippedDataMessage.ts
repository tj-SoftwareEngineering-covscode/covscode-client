import { ClientUser } from "../entity/clientUser";
import { BaseMessage, MessageType } from "./baseMessage";

export class ZippedDataMessage extends BaseMessage{
    repoId?: string;
    users?: ClientUser[];
    data?: string;

    constructor(repoId: string, users: ClientUser[], data: string){
        super(MessageType.ZippedDataMessage);
        this.repoId = repoId;
        this.users = users;
        this.data = data;
    }

    public getRepoId(){
        return this.repoId;
    }

    public getUsers(){
        return this.users;
    }

    public getData(){
        return this.data;
    }

    public setRepoId(repoId: string){
        this.repoId = repoId;
    }

    public setUsers(users: ClientUser[]){
        this.users = users;
    }

    public setData(data: string){
        this.data = data;
    }
}