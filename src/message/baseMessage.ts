export enum MessageType{
    SiteIdMessage='SiteIdMessage',
    WebSocketMessage='WebSocketMessage',
    ZippedDataMessage='ZippedDataMessage'
}

export class BaseMessage{
    private messageType:MessageType;

    constructor(messageType:MessageType){
        this.messageType = messageType;
    }
}