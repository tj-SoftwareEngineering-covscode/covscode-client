export class SiteIdMessage{
    private siteId?: number;

    constructor(siteId?: number){
        this.siteId = siteId;
    }

    public getSiteId(){
        return this.siteId;
    }

    public setSiteId(siteId: number){
        this.siteId = siteId;
    }
}