export class SiteIdMessage{
    private siteId?: string;

    constructor(siteId?: string){
        this.siteId = siteId;
    }

    public getSiteId(){
        return this.siteId;
    }

    public setSiteId(siteId: string){
        this.siteId = siteId;
    }
}