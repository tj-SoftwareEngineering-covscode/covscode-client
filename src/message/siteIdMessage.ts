import { BaseMessage, MessageType } from "./baseMessage";

export class SiteIdMessage extends BaseMessage{
    private siteId?: string;

    constructor(siteId?: string){
        super(MessageType.SiteIdMessage);
        this.siteId = siteId;
    }

    public getSiteId(){
        return this.siteId;
    }

    public setSiteId(siteId: string){
        this.siteId = siteId;
    }
}