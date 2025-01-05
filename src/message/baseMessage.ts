export enum MessageType{
    SiteIdMessage='SiteIdMessage',
    WebSocketMessage='WebSocketMessage',
    ZippedDataMessage='ZippedDataMessage'
}

export class BaseMessage{
    messageType:MessageType;

    constructor(messageType:MessageType){
        this.messageType = messageType;
    }

    public getMessageType(){
        return this.messageType;
    }

    public setMessageType(messageType:MessageType){
        this.messageType = messageType;
    }
}