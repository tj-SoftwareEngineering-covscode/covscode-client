import { Doc } from "sharedb";
import { ClientFile } from "../entity/clientFile";
import { ClientRepo } from "../entity/clientRepo";

export class DocManager{
    private static docMap: Map<string, Doc> = new Map();

    private static docVersionMap: Map<Doc, number> = new Map();

    public static dataClear(){
        this.docMap.clear();
        this.docVersionMap.clear();
    }

    public static getDoc(clientFile:ClientFile){
        const docId = clientFile.getClientRepo().getRepoId()! + clientFile.getRelativePath()!;
        return this.docMap.get(docId!);
    }

    public static addDoc(clientFile:ClientFile, doc:Doc){
        const docId = clientFile.getClientRepo().getRepoId()! + clientFile.getRelativePath()!;
        this.docMap.set(docId!, doc);
    }

    public static getRepoDoc(clientRepo:ClientRepo){
        const key = clientRepo.getRepoId()! + "cursor";
        return this.docMap.get(key);
    }

    public static addRepoDoc(clientRepo:ClientRepo, doc:Doc){
        const key = clientRepo.getRepoId()! + "cursor";
        DocManager.docMap.set(key, doc);
    }

    public static hasLastVersion(doc: Doc){
        return doc ? DocManager.docVersionMap.has(doc) : false;
    }
    
    public static getLastVersion(doc: Doc){
        return doc ? DocManager.docVersionMap.get(doc) || null : null;
    }
    
    public static setLastVersion(doc: Doc) {
        if (doc) {
            DocManager.docVersionMap.set(doc, doc.version!);
        }
    }

    public static clear(){
        this.docMap.clear();
        this.docVersionMap.clear();
    }
}