import { BaseAction } from '../action/baseAction';

export class WebSocketMessage{
    private data:BaseAction;
    private isSuccessful:boolean;
    private errorMessage?:string;
    private errorCode?:string;
    
    constructor(data:BaseAction, isSuccessful:boolean, errorMessage?:string, errorCode?:string){
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