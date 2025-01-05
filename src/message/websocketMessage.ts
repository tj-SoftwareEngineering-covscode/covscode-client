import { BaseAction } from '../action/baseAction';
import { BaseMessage, MessageType } from './baseMessage';

export class WebSocketMessage extends BaseMessage{
    data:BaseAction;
    isSuccessful:boolean;
    errorMessage?:string;
    errorCode?:string;
    
    constructor(data:BaseAction, isSuccessful:boolean, errorMessage?:string, errorCode?:string){
        super(MessageType.WebSocketMessage);
        this.data = data;
        this.isSuccessful = isSuccessful;
        this.errorMessage = errorMessage;
        this.errorCode = errorCode;
    }

    public getData(){
        return this.data;
    }

    public getIsSuccessful(){
        return this.isSuccessful;
    }

    public getErrorMessage(){
        return this.errorMessage;
    }

    public getErrorCode(){
        return this.errorCode;
    }

    public setIsSuccessful(isSuccessful:boolean){
        this.isSuccessful = isSuccessful;
    }

    public setErrorMessage(errorMessage:string){
        this.errorMessage = errorMessage;
    }

    public setErrorCode(errorCode:string){
        this.errorCode = errorCode;
    }  
}