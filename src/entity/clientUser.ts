export class ClientUser{
    private userId?:string;
    private siteId?:string;
    private repoId?:string;

    constructor(userId?:string, siteId?:string, repoId?:string){
        this.userId = userId;
        this.siteId = siteId;
        this.repoId = repoId;
    }

    public setUserId(userId:string){
        this.userId = userId;
    }

    public setSiteId(siteId:string){
        this.siteId = siteId;
    }

    public setRepoId(repoId:string){
        this.repoId = repoId;
    }           

    public getUserId(){
        return this.userId;
    }

    public getSiteId(){
        return this.siteId;
    }

    public getRepoId(){
        return this.repoId;
    }   
} 